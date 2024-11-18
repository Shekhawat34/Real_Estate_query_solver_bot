import React, { useState, useEffect } from 'react';
import './App.css';

function PropertyCard({ property, activeImage }) {
  return (
    <div className="property-card">
      <div className="image-carousel">
        {property.images &&
          property.images.map((image, imgIndex) => (
            <img
              key={imgIndex}
              src={image}
              alt={`${property.name} - Image ${imgIndex + 1}`}
              className={`property-image ${activeImage[property.name] === imgIndex ? 'active' : ''}`}
              onError={(e) => e.target.src = '/fallback-image.jpg'} // Replace with a valid fallback image path
              loading="lazy"
            />
          ))}
      </div>
      <div className="property-info">
        <h3>{property.name}</h3>
        <p className="location">{property.location}</p>
        <p className="status">{property.project_status}</p>
        <p className="description">{property.description}</p>
        <div className="details">
          <p><strong>Type:</strong> {property.bedrooms}</p>
          <p><strong>Development Size:</strong> {property.development_size}</p>
          <p><strong>Total Units:</strong> {property.total_units}</p>
        </div>
        <div className="amenities">
          <h4>Amenities:</h4>
          <div className="amenities-grid">
            {property.amenities &&
              Object.entries(property.amenities).map(([category, items]) => (
                <div key={category} className="amenity-category">
                  <h5>{category.charAt(0).toUpperCase() + category.slice(1)}</h5>
                  <ul>
                    {items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [properties, setProperties] = useState([]);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeImage, setActiveImage] = useState({});
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState(false);

  useEffect(() => {
    setPropertiesLoading(true);
    fetch('http://localhost:5000/api/properties')
      .then((response) => response.json())
      .then((data) => {
        console.log('Fetched properties:', data);
        setProperties(data.residential || []);
        setPropertiesError(false);
      })
      .catch((error) => {
        console.error('Error:', error);
        setPropertiesError(true);
      })
      .finally(() => {
        setPropertiesLoading(false);
      });
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveImage((prevActiveImage) => {
        const newActiveImage = { ...prevActiveImage };
        properties.forEach((property) => {
          const currentIndex = prevActiveImage[property.name] || 0;
          const nextIndex = (currentIndex + 1) % property.images.length;
          newActiveImage[property.name] = nextIndex;
        });
        return newActiveImage;
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [properties]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
  
    setChatHistory((prev) => [...prev, { type: 'user', content: message }]);
    setLoading(true);
  
    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
  
      const data = await response.json();
      
      // More comprehensive location extraction
      const locationPatterns = [
        /in\s+([\w\s]+)/i,
        /near\s+([\w\s]+)/i,
        /around\s+([\w\s]+)/i,
        /([\w\s]+)\s*properties/i,
        /([\w\s]+)\s*location/i
      ];
  
      let filtered = [];
      for (let pattern of locationPatterns) {
        const match = pattern.exec(data.response);
        if (match) {
          const location = match[1].trim().toLowerCase();
          filtered = properties.filter(property => 
            property.location.toLowerCase().includes(location) ||
            location.split(/\s+/).some(locPart => 
              property.location.toLowerCase().includes(locPart)
            )
          );
          
          if (filtered.length > 0) break;
        }
      }
  
      // If no location-based filtering worked, use the backend's property images
      if (filtered.length === 0 && data.properties) {
        filtered = data.properties.map(propImg => 
          properties.find(p => p.name === propImg.name)
        ).filter(Boolean);
      }
  
      setChatHistory((prev) => [
        ...prev,
        { 
          type: 'bot', 
          content: data.response, 
          properties: filtered.length > 0 ? filtered : null 
        }
      ]);
    } catch (error) {
      console.error('Error:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'bot',
          content: 'Sorry, there was an error processing your request.',
          properties: []
        },
      ]);
    }
  
    setLoading(false);
    setMessage('');
  };

  return (
    <div className="app-container">
      <div className="properties-container">
        {propertiesLoading ? (
          <div className="loading">Loading properties...</div>
        ) : propertiesError ? (
          <div className="error">Failed to load properties. Please try again later.</div>
        ) : (
          properties.map((property, index) => (
            <PropertyCard key={index} property={property} activeImage={activeImage} />
          ))
        )}
      </div>

      <div className="chat-container">
        <div className="chat-history">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.type}`}>
              <p>{msg.content}</p>
              {msg.type === 'bot' && msg.properties && (
                <div className="filtered-properties">
                  {msg.properties.length > 0 ? (
                    msg.properties.map((property, propIndex) => (
                      <PropertyCard key={propIndex} property={property} activeImage={activeImage} />
                    ))
                  ) : (
                    <p>No matching properties found for the specified location.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="loading">Loading...</div>}
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about our properties..."
            className="chat-input"
          />
          <button type="submit" disabled={loading}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;
