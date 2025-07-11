import React from 'react';

const PersonalitySelector = ({
  currentPersonalityKey,
  setCurrentPersonalityKey,
  personalityProfiles,
  currentProfile,
}) => {
  return (
    <div style={{ padding: '10px 0' }}>
      <h4>Select AI Personality:</h4>
      <select
        id="personality-select"
        value={currentPersonalityKey}
        onChange={(e) => setCurrentPersonalityKey(e.target.value)}
        style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
      >
        {Object.keys(personalityProfiles).map(key => (
          <option key={key} value={key}>
            {personalityProfiles[key].displayName}
          </option>
        ))}
      </select>
      {currentProfile && currentProfile.avatar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
          <img
            src={currentProfile.avatar}
            alt={`${currentProfile.displayName} Avatar`}
            style={{ width: '60px', height: '60px', borderRadius: '50%', border: `3px solid ${currentProfile.themeColors['--ai-primary-color'] || '#ccc'}` }}
          />
          <div>
            <h2 style={{ margin: 0, color: currentProfile.themeColors['--ai-primary-color'] || '#333' }}>
              {currentProfile.displayName}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalitySelector;
