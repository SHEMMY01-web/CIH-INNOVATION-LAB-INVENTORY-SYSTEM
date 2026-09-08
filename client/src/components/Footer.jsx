import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="cih-footer">
      <div className="footer-container">
        {/* Top section: Logo, Mission */}
        <div className="footer-top-section">
          <div className="footer-logo-wrapper">
            <a href="https://cih.com.ng/" target="_blank" rel="noopener noreferrer">
              <img
                src="/IMAGES/cih-footer-logo.png"
                alt="Community Innovation Hub"
                className="cih-footer-logo"
              />
            </a>
          </div>

          <div className="footer-mission-block">
            <h3 className="footer-mission-heading">Our Mission</h3>
            <div className="mission-underline"></div>
            <p className="footer-mission-paragraph">
              To Provide Holistic Education, Leadership Incubation And STEM Education To Teenagers And Other Young People, Thus Making Transformational Leaders Out Of Them
            </p>
          </div>
        </div>

        {/* Subtle separator */}
        <div className="footer-divider-line"></div>

        {/* Bottom bar: Copyright, Menu links, Scroll-to-top */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright-text">
            &copy;copyright 2023 Community Innovation Hub.
          </div>
        </div>
      </div>
    </footer>
  );
}
