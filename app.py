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
    api_key=os.environ.get("GROQ_API_KEY", ""),
    model_name="mixtral-8x7b-32768"
)

# Prompt template for LangChain
prompt = PromptTemplate(
    input_variables=["question", "properties", "query_type"],
    template="""
    You are a helpful real estate assistant for Prestige Properties. Based on the following property information:
    {properties}
    
    Question type: {query_type}
    Question: {question}
    
    Please provide a clear, concise response to address the user's query. Include relevant property details like name, location, size, and amenities if applicable.
    If no matching properties are found, clearly state so.
    """
)

chain = LLMChain(llm=llm, prompt=prompt)

def identify_query_type(user_message):
    """
    Identify query components (e.g., location, price, amenities) based on user message.
    """
    message = user_message.lower()
    query_types = []

    keywords = {
        "name": r'\b(name|property name|listing|called|known as)\b',
        "location": r'\b(where|location|area|near|in)\b',
        "price": r'\b(price|cost|budget|expensive|cheap)\b',
        "bedrooms": r'\b(bhk|bedroom|bedrooms|bathroom)\b',
        "amenities": r'\b(amenity|facility|feature|parking|pool|gym)\b',
        "development_size": r'\b(development size|square feet|sqft|size)\b'
    }

    for query_type, pattern in keywords.items():
        if re.search(pattern, message):
            query_types.append(query_type)

    # Default to 'general' if no specific type is identified
    return query_types if query_types else ["general"]

def filter_properties(user_message, query_types):
    """
    Filter properties based on query types and user input.
    """
    message = user_message.lower()
    filtered_properties = PROPERTY_DATA['residential'] + PROPERTY_DATA.get('rental', [])

    for query_type in query_types:
        if query_type == 'location':
            locations = re.findall(r'\b(?:in|near|around)\s*([\w\s]+)', message, re.IGNORECASE)
            locations = [loc.strip().lower() for loc in locations]
            if locations:
                filtered_properties = [
                    prop for prop in filtered_properties
                    if any(loc in prop["location"].lower() for loc in locations)
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
            name_search = re.findall(r'\b(?:called|name|known as)?\s*([\w\s]+)\b', message)
            if name_search:
                target_name = name_search[0].strip().lower()
                filtered_properties = [
                    prop for prop in filtered_properties
                    if target_name in prop["name"].lower()
                ]
        elif query_type == 'price':
            price_matches = re.findall(r'\d+', message)
            if price_matches:
                target_price = int(price_matches[0])
                filtered_properties = [
                    prop for prop in filtered_properties
                    if abs(prop.get("price", 0) - target_price) <= target_price * 0.2
                ]
        elif query_type == 'amenities':
            amenities = re.findall(r'\b(pool|gym|parking|jogging|clubhouse)\b', message)
            amenities = [amenity.lower() for amenity in amenities]
            if amenities:
                filtered_properties = [
                    prop for prop in filtered_properties
                    if any(amenity in json.dumps(prop.get("amenities", "")).lower() for amenity in amenities)
                ]
    return filtered_properties[:5]  # Limit results to top 5

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')

    try:
        query_types = identify_query_type(user_message)
        filtered_properties = filter_properties(user_message, query_types)

        property_summary = [
            {
                "name": prop["name"],
                "location": prop["location"],
                "bedrooms": prop["bedrooms"],
                "development_size": prop.get("development_size", "N/A"),
                "image": prop.get("images", [None])[0]
            }
            for prop in filtered_properties
        ]

        properties_str = json.dumps(filtered_properties, indent=2)
        response = chain.run(
            question=user_message,
            properties=properties_str,
            query_type=", ".join(query_types)
        )

        return jsonify({
            'response': response.strip(),
            'properties': property_summary
        })

    except Exception as e:
        print("Error:", e)
        return jsonify({'error': "An error occurred while processing your request."}), 500

@app.route('/api/properties', methods=['GET'])
def get_properties():
    return jsonify(PROPERTY_DATA)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
