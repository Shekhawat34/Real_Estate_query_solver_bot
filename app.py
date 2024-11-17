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
    """Identify the type of query being asked"""
    message = user_message.lower()
    
    if re.search(r'\b(where|location|area|near|in)\b', message):
        return 'location'
    elif re.search(r'\b(price|cost|budget|expensive|cheap)\b', message):
        return 'price'
    elif re.search(r'\b(bhk|bedroom|bathroom|size|square)\b', message):
        return 'properties'
    elif re.search(r'\b(amenity|facility|feature|parking|pool|gym)\b', message):
        return 'amenities'
    return 'general'

def filter_properties(user_message, query_type):
    """Enhanced property filtering based on query type and specific criteria"""
    message = user_message.lower()
    filtered_properties = []
    
    if query_type == 'location':
        # Extract location keywords and match exactly
        locations = re.findall(r'\b(?:near|in)?\s*(\w+(?:\s+\w+)*)\b', message)
        filtered_properties = [
            prop for prop in PROPERTY_DATA['residential'] + PROPERTY_DATA['rental']
            if any(loc.lower() in prop["location"].lower() for loc in locations)
        ]
    
    elif query_type == 'price':
        # Extract price range if mentioned
        price_matches = re.findall(r'\d+', message)
        if price_matches:
            target_price = int(price_matches[0])
            # Consider price for residential properties and rent_price for rental properties
            filtered_properties = [
                prop for prop in PROPERTY_DATA['residential'] + PROPERTY_DATA['rental']
                if (prop.get("price") and abs(prop.get("price", 0) - target_price) <= target_price * 0.2) or
                   (prop.get("rent_price") and abs(prop.get("rent_price", 0) - target_price) <= target_price * 0.2)
            ]
    
    elif query_type == 'properties':
        # Match specific property features
        filtered_properties = [
            prop for prop in PROPERTY_DATA['residential'] + PROPERTY_DATA['rental']
            if any(keyword in json.dumps(prop).lower() for keyword in message.split())
        ]
    
    elif query_type == 'amenities':
        # Match specific amenities
        filtered_properties = [
            prop for prop in PROPERTY_DATA['residential'] + PROPERTY_DATA['rental']
            if any(amenity.lower() in message for amenity in prop.get("amenities", []))
        ]
    
    else:  # general query
        filtered_properties = [
            prop for prop in PROPERTY_DATA['residential'] + PROPERTY_DATA['rental']
            if any(keyword in json.dumps(prop).lower() for keyword in message.split())
        ]
    
    return filtered_properties[:5]  # Limit to top 5 most relevant matches

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    
    try:
        # Identify query type
        query_type = identify_query_type(user_message)
        
        # Filter properties based on query type and message
        filtered_properties = filter_properties(user_message, query_type)
        
        # Extract property names and images from the filtered properties
        property_images = [
            {"name": prop["name"], "images": prop.get("images", [])}
            for prop in filtered_properties
        ]
        
        # Convert filtered properties to string
        properties_str = json.dumps(filtered_properties, indent=2)
        
        # Get response from LangChain
        response = chain.run(
            question=user_message,
            properties=properties_str,
            query_type=query_type
        )
        
        if not response:
            return jsonify({
                'response': "I couldn't find any properties matching your specific criteria.",
                'properties': []
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
