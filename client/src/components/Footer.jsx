import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="cih-footer">
      <div className="footer-container">
        {/* Top section: Logo, Mission */}
        <div className="footer-top-section">
          <div className="footer-logo-wrapper">
            <Link to="/" title="CIH Innovation Lab - Home">
              <img
                src="/IMAGES/cih-footer-logo.png"
                alt="Community Innovation Hub"
                className="cih-footer-logo"
              />
            </Link>
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
            &copy; {currentYear} Community Innovation Hub. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
