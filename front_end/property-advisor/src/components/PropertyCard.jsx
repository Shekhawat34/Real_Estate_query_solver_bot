//PropertyCard.js
import React from 'react';
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";

function PropertyCard({ property }) {
  const images = [...(property.images || []), ...(property.image_url || [])].filter(Boolean);
  const projectUrl = property.property_url?.[0] || property.project_url?.[0];

  return (
    <div className="property-card">
      <div className="carousel-container">
        <Carousel
          showThumbs={false}
          infiniteLoop
          showStatus={false}
          showIndicators={false}
          className="property-carousel"
        >
          {images.map((image, index) => (
            <div key={index} className="carousel-slide">
              <img src={image} alt={`Property view ${index + 1}`} />
            </div>
          ))}
        </Carousel>
      </div>

      <div className="property-info">
        <h3 className="property-title">{property.name}</h3>
        <p className="property-subtitle">{property.location}</p>
      </div>

      <div className="property-actions">
        <div className="action-button-container">

          <a  href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-button"
          >
            Show Details
          </a>
          {property.map_url && (

            <a  href={property.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button"
            >
              View on Map
            </a>
          )}
          {property.visit_schedule && (

            <a  href={property.visit_schedule}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button"
            >
              Schedule Visit
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropertyCard;