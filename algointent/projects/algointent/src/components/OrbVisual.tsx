const OrbVisual = () => {
  return (
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6 sm:mb-8 animate-float">
      <div 
        className="absolute inset-0 rounded-full opacity-90 animate-pulse-glow"
        style={{
          background: 'var(--gradient-orb)',
        }}
      />
      <div 
        className="absolute inset-3 sm:inset-4 rounded-full bg-white/30 backdrop-blur-sm"
      />
    </div>
  );
};

export default OrbVisual;
