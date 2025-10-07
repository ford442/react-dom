import React from 'react';

const PersonalitySelector = ({ personalityProfiles, currentPersonalityKey, setCurrentPersonalityKey }) => (
  <div className="panel-section">
    <h3>AI Personality</h3>
    <select
      value={currentPersonalityKey}
      onChange={(e) => setCurrentPersonalityKey(e.target.value)}
    >
      {Object.keys(personalityProfiles).map(key => (
        <option key={key} value={key}>
          {personalityProfiles[key].displayName}
        </option>
      ))}
    </select>
  </div>
);

export default PersonalitySelector;
