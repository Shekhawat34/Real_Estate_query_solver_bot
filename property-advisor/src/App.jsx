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

  useEffect(() => {
    // Fetch properties when the component mounts
    setPropertiesLoading(true);
    fetch('http://localhost:5000/api/properties')
      .then((response) => response.json())
      .then((data) => {
        console.log('Fetched properties:', data);  // Debugging line
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
      setChatHistory((prev) => [...prev, { type: 'bot', content: data.response }]);
    } catch (error) {
      console.error('Error:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'bot',
          content: 'Sorry, there was an error processing your request.',
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
                      onClick={() =>
                        setActiveImage({
                          ...activeImage,
                          [property.name]: imgIndex,
                        })
                      }
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
              {msg.content}
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
