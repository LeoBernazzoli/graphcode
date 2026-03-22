import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, Binary, Database, Zap } from 'lucide-react';

const Hero = () => {
  return (
    <section className="hero-section" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Linear-style Spotlight Glow at the top */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '80%', height: '60%',
        background: 'radial-gradient(ellipse at top, rgba(255, 255, 255, 0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 10, textAlign: 'center', paddingTop: '60px' }}>
        
        {/* Subtle Announcement Pill */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '99px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '40px' }}
        >
          <span>Introducing Autoclaw 1.0</span>
          <ChevronRight size={14} />
        </motion.div>

        {/* Massive Linear-style Typography */}
        <motion.h1 
          className="text-gradient"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: '96px', fontWeight: '600', letterSpacing: '-0.05em', lineHeight: '1.05', marginBottom: '24px', maxWidth: '1000px', margin: '0 auto 24px auto' }}
        >
          AI coding tools <br />
          don't understand your codebase
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: '22px', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 40px auto', lineHeight: '1.5', fontWeight: '400' }}
        >
          Autoclaw gives them persistent memory and structural code understanding. Stop losing context and make precise changes.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}
        >
          <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '15px', display: 'flex', gap: '8px' }}>
            Get Started <ArrowRight size={16} />
          </button>
        </motion.div>

        {/* The new SUPER HIGH END SVG Data Visualization */}
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 40 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
           style={{ marginTop: '80px', display: 'flex', justifyContent: 'center', perspective: '1000px' }}
        >
          <div style={{
            width: '100%', maxWidth: '1040px', height: '520px',
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(20,20,22,0.8) 0%, rgba(9,9,11,0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
            overflow: 'hidden',
            display: 'flex'
          }}>
            
            {/* Ambient inner glow */}
            <div style={{ position: 'absolute', top: '20%', left: '30%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            {/* Pure SVG Architectural Blueprint */}
            <div style={{ flex: 1, position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                  </linearGradient>
                  
                  {/* Subtle Grid Pattern inside the SVG */}
                  <pattern id="dotGrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.05)" />
                  </pattern>
                </defs>

                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                {/* High-end Technical Layout Background Lines */}
                <g stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none">
                   {/* Horizontal rails */}
                   <line x1="0" y1="150" x2="1000" y2="150" />
                   <line x1="0" y1="350" x2="1000" y2="350" />
                   
                   {/* Vertical guides */}
                   <line x1="250" y1="0" x2="250" y2="500" />
                   <line x1="750" y1="0" x2="750" y2="500" />
                   
                   {/* Diagonal connecting wires */}
                   <line x1="250" y1="150" x2="500" y2="250" />
                   <line x1="250" y1="350" x2="500" y2="250" />
                   <line x1="500" y1="250" x2="750" y2="150" />
                   <line x1="500" y1="250" x2="750" y2="350" />
                </g>

                {/* Animated Data Flow Pulses */}
                <g filter="url(#glow)">
                  <path d="M 250 250 L 500 150 L 750 250" fill="none" stroke="url(#lineGrad)" strokeWidth="2">
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="stroke-dasharray" values="0,100; 100,0; 0,100" dur="4s" repeatCount="indefinite" />
                  </path>
                  <path d="M 250 250 L 500 350 L 750 250" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 4">
                    <animate attributeName="stroke-dashoffset" from="24" to="0" dur="2s" repeatCount="indefinite" />
                  </path>
                </g>

                <line x1="100" y1="250" x2="250" y2="250" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4 4" filter="url(#glow)">
                   <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
                </line>

                <line x1="750" y1="250" x2="900" y2="250" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4 4" filter="url(#glow)">
                   <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite" />
                </line>

                {/* Central Autoclaw Engine Node */}
                <g transform="translate(500, 250)">
                  {/* Outer Radar Rings */}
                  <circle cx="0" cy="0" r="80" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1">
                     <animate attributeName="r" values="80;120" dur="3s" repeatCount="indefinite" />
                     <animate attributeName="opacity" values="1;0" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="0" cy="0" r="60" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  
                  {/* Glowing Core */}
                  <circle cx="0" cy="0" r="24" fill="rgba(255,255,255,1)" filter="url(#glow)" />
                  <circle cx="0" cy="0" r="24" fill="rgba(255,255,255,1)" />
                  
                  {/* Text Details */}
                  <text x="0" y="3" fill="#000" fontSize="10" fontWeight="800" textAnchor="middle" letterSpacing="0.05em">AC</text>
                  <text x="0" y="-70" fill="var(--text-secondary)" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="0.1em">AUTOCLAW_CORE</text>
                </g>

                {/* Left Source Node representing Chat/Prompt */}
                <g transform="translate(250, 250)">
                   <rect x="-35" y="-35" width="70" height="70" rx="16" fill="rgba(20,20,22,0.8)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" filter="url(#softGlow)" />
                   <circle cx="0" cy="0" r="4" fill="#fff" filter="url(#glow)" />
                   <text x="0" y="55" fill="var(--text-secondary)" fontSize="11" fontFamily="monospace" textAnchor="middle">LLM_PROMPT</text>
                </g>

                {/* Right Target Node representing Codebase */}
                <g transform="translate(750, 250)">
                   <rect x="-35" y="-35" width="70" height="70" rx="16" fill="rgba(20,20,22,0.8)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" filter="url(#softGlow)" />
                   <circle cx="0" cy="0" r="4" fill="#fff" filter="url(#glow)" />
                   <text x="0" y="55" fill="var(--text-secondary)" fontSize="11" fontFamily="monospace" textAnchor="middle">REPO_AST</text>
                </g>

                {/* Tech floating widgets overlay */}
                <g transform="translate(420, 80)">
                   <rect x="0" y="0" width="160" height="28" rx="6" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.1)" />
                   <circle cx="16" cy="14" r="4" fill="#27c93f" />
                   <text x="32" y="18" fill="#fff" fontSize="10" fontFamily="monospace">SYNC: MEMORY_MAP</text>
                </g>

                <g transform="translate(420, 392)">
                   <rect x="0" y="0" width="160" height="28" rx="6" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.1)" />
                   <circle cx="16" cy="14" r="4" fill="#ffbd2e" />
                   <text x="32" y="18" fill="#fff" fontSize="10" fontFamily="monospace">BUILD: DEV_GRAPH</text>
                </g>
              </svg>

              {/* HTML overlaid UI Elements for absolute crispy rendering */}
              <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', gap: '8px' }}>
                 <div style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)' }}>
                   <Binary size={12} color="#fff" /> V1.0.4
                 </div>
                 <div style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)' }}>
                   <Database size={12} color="#fff" /> DB_READY
                 </div>
              </div>

            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default Hero;
