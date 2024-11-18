from flask import Flask, request, jsonify
from flask_cors import CORS
from config import PROPERTY_DATA
from langchain.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains import LLMChain
import os
import json
import re

app = Flask(__name__)
CORS(app)

llm = ChatGroq(
    api_key=os.environ["GROQ_API_KEY"],
    model_name="mixtral-8x7b-32768"
)

# Enhanced prompt template with more specific instructions
prompt = PromptTemplate(
    input_variables=["question", "properties", "query_type"],
    template="""
    You are a helpful real estate assistant for Prestige Properties. Based on the following property information:
    {properties}
    
    Question type: {query_type}
    Question: {question}
    
    Please provide a focused response that specifically addresses the user's query. Only mention properties that exactly match the search criteria.
    If discussing location, mention only properties in that exact location.
    If discussing specific features or amenities, only mention properties that have those features.
    If no exact matches are found, clearly state that no properties match those specific criteria.
    """
)

chain = LLMChain(llm=llm, prompt=prompt)

def identify_query_type(user_message):
    """Identify the types of query components, allowing for mixed questions."""
    message = user_message.lower()
    query_types = []
    
    if re.search(r'\b(name|property name|listing|called|known as)\b', message):
        query_types.append('name')
    if re.search(r'\b(where|location|area|near|in)\b', message):
        query_types.append('location')
    if re.search(r'\b(price|cost|budget|expensive|cheap)\b', message):
        query_types.append('price')
    if re.search(r'\b(bhk|bedroom|bedrooms|bathroom|size|square)\b', message):
        query_types.append('properties')
    if re.search(r'\b(amenity|facility|feature|parking|pool|gym)\b', message):
        query_types.append('amenities')
    if re.search(r'\b(development size|square feet|sqft|size)\b', message):
        query_types.append('development_size')
    if re.search(r'\b(bedrooms|bedroom|bhk)\b', message):
        query_types.append('bedrooms')
    
    # Default to general if no specific type is identified
    if not query_types:
        query_types.append('general')
    
    return query_types

def filter_properties(user_message, query_types):
    """Filter properties based on multiple query criteria in the message."""
    message = user_message.lower()
    filtered_properties = PROPERTY_DATA['residential'] + PROPERTY_DATA.get('rental', [])
    
    # Enhanced location matching with more flexible parsing
    def match_location(prop_location, search_locations):
        prop_parts = prop_location.lower().split(', ')
        return any(
            any(search_loc in prop_part for prop_part in prop_parts) 
            for search_loc in search_locations
        )
    
    for query_type in query_types:
        if query_type == 'location':
            # More comprehensive location extraction
            location_patterns = [
                r'\b(?:in|near|around)\s*([\w\s]+)',
                r'\b([\w\s]+)\s*properties\b',
                r'\b([\w\s]+)\s*location\b'
            ]
            
            locations = []
            for pattern in location_patterns:
                locations.extend(re.findall(pattern, message, re.IGNORECASE))
            
            # Remove duplicates and clean locations
            locations = list(set(loc.strip() for loc in locations if loc.strip()))
            
            if locations:
                filtered_properties = [
                    prop for prop in filtered_properties
                    if match_location(prop["location"], [loc.lower() for loc in locations])
                ]
        
        elif query_type == 'bedrooms':
            bedroom_matches = re.findall(r'(\d+)\s*bhk', message)
            if bedroom_matches:
                target_bedrooms = bedroom_matches[0]
                filtered_properties = [
                    prop for prop in filtered_properties
                    if target_bedrooms in prop.get("bedrooms", "").lower()
                ]
        
        elif query_type == 'name':
            name_search = re.findall(r'\b(?:called|name|known as)?\s*(\w+(?:\s+\w+)*)\b', message)
            if name_search:
                target_name = name_search[0].strip()
                filtered_properties = [
                    prop for prop in filtered_properties
                    if prop["name"].lower() == target_name.lower()
                ]
        
        elif query_type == 'price':
            price_matches = re.findall(r'\d+', message)
            if price_matches:
                target_price = int(price_matches[0])
                filtered_properties = [
                    prop for prop in filtered_properties
                    if (prop.get("price") and abs(prop.get("price", 0) - target_price) <= target_price * 0.2)
                ]
        
        elif query_type == 'amenities':
            filtered_properties = [
                prop for prop in filtered_properties
                if any(amenity.lower() in message for amenity in prop.get("amenities", {}).values())
            ]
        
        elif query_type == 'development_size':
            size_matches = re.findall(r'\d+', message)
            if size_matches:
                target_size = int(size_matches[0])
                filtered_properties = [
                    prop for prop in filtered_properties
                    if prop.get("development_size") and abs(int(prop["development_size"].split()[0]) - target_size) <= target_size * 0.1
                ]

    # Always return a list of properties that match the criteria, up to a certain number
    return filtered_properties[:5]  # Limit to top 5 properties to avoid overloading the response

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    
    try:
        # Identify query types in the user message
        query_types = identify_query_type(user_message)
        
        # Filter properties based on identified query types
        filtered_properties = filter_properties(user_message, query_types)
        
        # Extract property names and images from the filtered properties
        property_images = [
            {"name": prop["name"], "images": prop.get("images", [])}
            for prop in filtered_properties
        ]
        
        # Convert filtered properties to a string for input to LangChain
        properties_str = json.dumps(filtered_properties, indent=2)
        
        # Get response from LangChain
        response = chain.run(
            question=user_message,
            properties=properties_str,
            query_type=", ".join(query_types)
        )
        
        if not response:
            return jsonify({
                'response': "I couldn't find any properties matching your specific criteria.",
                'properties': property_images
            })
            
        return jsonify({'response': response, 'properties': property_images})
        
    except Exception as e:
        print("Error:", e)
        return jsonify({
            'error': f"An error occurred: {str(e)}"
        }), 500

@app.route('/api/properties', methods=['GET'])
def get_properties():
    return jsonify(PROPERTY_DATA)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
