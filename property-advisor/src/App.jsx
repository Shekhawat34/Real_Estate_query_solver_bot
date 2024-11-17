import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [properties, setProperties] = useState([]);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeImage, setActiveImage] = useState({});
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState(false);
  const [filteredProperties, setFilteredProperties] = useState([]);

  useEffect(() => {
    setPropertiesLoading(true);
    fetch('http://localhost:5000/api/properties')
      .then((response) => response.json())
      .then((data) => {
        console.log('Fetched properties:', data); // Debugging line
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
    }, 3000); // Change image every 3 seconds

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

      // Extract location from chatbot response for filtering properties
      const locationMatch = /in ([a-zA-Z\s]+)/.exec(data.response); // Adjust regex as needed
      const location = locationMatch ? locationMatch[1].trim() : '';

      let filtered = [];
      if (location) {
        filtered = properties.filter(property =>
          property.location.toLowerCase().includes(location.toLowerCase())
        );
        setFilteredProperties(filtered);
      }

      setChatHistory((prev) => [
        ...prev,
        { type: 'bot', content: data.response, properties: filtered }
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
            <div key={index} className="property-card">
              <div className="image-carousel">
                {property.images &&
                  property.images.map((image, imgIndex) => (
                    <img
                      key={imgIndex}
                      src={image}
                      alt={`${property.name} - Image ${imgIndex + 1}`}
                      className={`property-image ${activeImage[property.name] === imgIndex ? 'active' : ''}`}
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
          ))
        )}
      </div>

      <div className="chat-container">
        <div className="chat-history">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.type}`}>
              <p>{msg.content}</p>
              {msg.type === 'bot' && msg.properties && msg.properties.length > 0 && (
                <div className="filtered-properties">
                  {msg.properties.map((property, propIndex) => (
                    <div key={propIndex} className="filtered-property-card">
                      <h4>{property.name}</h4>
                      <div className="filtered-image-carousel">
                        {property.images &&
                          property.images.map((image, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={image}
                              alt={`${property.name} - Image ${imgIndex + 1}`}
                              className="filtered-property-image"
                              loading="lazy"
                            />
                          ))}
                      </div>
                      <p className="location">{property.location}</p>
                    </div>
                  ))}
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
