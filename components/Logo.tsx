
import React from 'react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={className} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      {/* Metallic Platinum Gradient */}
      <linearGradient id="plat-grad" x1="0" y1="0" x2="100" y2="100">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      
      {/* Cyber/Innovation Cyan Gradient */}
      <linearGradient id="core-grad" x1="100" y1="0" x2="0" y2="100">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>

      {/* Glow Effect */}
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    {/* Outer Structural Shell (Abstract P/Hexagon) */}
    <path 
      d="M50 5 L88.97 27.5 V72.5 L50 95 L11.03 72.5 V27.5 L50 5 Z" 
      stroke="url(#plat-grad)" 
      strokeWidth="2"
      fill="none"
      opacity="0.5"
    />

    {/* Inner Geometric Shards */}
    <path 
      d="M50 20 L75 35 V65 L50 80 L25 65 V35 L50 20 Z" 
      fill="url(#plat-grad)" 
      opacity="0.1"
    />
    
    {/* The Core Circuitry (Abstract Neural Connection) */}
    <g filter="url(#glow)">
        <path d="M50 50 L75 35" stroke="url(#core-grad)" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 50 L25 65" stroke="url(#core-grad)" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 50 L50 20" stroke="url(#core-grad)" strokeWidth="3" strokeLinecap="round" />
        
        {/* Central Node */}
        <circle cx="50" cy="50" r="8" fill="url(#core-grad)" />
    </g>
    
    {/* Accent Details */}
    <circle cx="75" cy="35" r="2" fill="#ffffff" />
    <circle cx="25" cy="65" r="2" fill="#ffffff" />
    <circle cx="50" cy="20" r="2" fill="#ffffff" />

  </svg>
);
