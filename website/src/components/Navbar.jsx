import React from 'react';
import { motion } from 'framer-motion';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="container nav-container">
        
        {/* Temporary Autoclaw Logo */}
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Elegant technical 'A' motif representing an open claw/bracket */}
            <path d="M12 2L3 22H7.5L12 10.5L16.5 22H21L12 2Z" fill="white" />
          </svg>
          <span className="logo-text" style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '-0.02em', color: '#fff' }}>Autoclaw</span>
        </div>

        <ul style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <li><a href="#how-it-works" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500', transition: 'color 0.2s' }}>How it works</a></li>
          <li><a href="#solution" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500', transition: 'color 0.2s' }}>Engines</a></li>
          <li><a href="https://github.com/autoclaw" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500', transition: 'color 0.2s' }}>GitHub</a></li>
          <li><button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>View Documentation</button></li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
