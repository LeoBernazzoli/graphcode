import React from 'react';

const Navbar = () => {
  return (
    <nav className="navbar glass-panel">
      <div className="container nav-container">
        <div className="logo cursor-pointer group">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="logo-icon group-hover:glow">
            <path d="M12 2L2 22h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M12 12v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="logo-text">AUTOCLAW</span>
        </div>
        
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#docs">Docs</a></li>
        </ul>
        
        <div className="nav-actions">
          <button className="btn btn-secondary btn-sm">GitHub</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
