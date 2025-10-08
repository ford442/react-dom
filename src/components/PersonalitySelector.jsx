import React from 'react';
// Import the necessary components from Material-UI
import { FormControl, InputLabel, Select, MenuItem, Box, Typography } from '@mui/material';

const PersonalitySelector = ({ personalityProfiles, currentPersonalityKey, setCurrentPersonalityKey }) => (
  // 'Box' is an MUI component that can act as a container.
  // The 'sx' prop lets us write styles directly. This replaces the old 'panel-section' class.
  <Box sx={{ 
    padding: '1rem',
    marginBottom: '1rem',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    backgroundColor: '#fff' 
  }}>
    <FormControl fullWidth>
      <InputLabel id="personality-select-label">AI Personality</InputLabel>
      <Select
        labelId="personality-select-label"
        id="personality-select"
        value={currentPersonalityKey}
        label="AI Personality"
        onChange={(e) => setCurrentPersonalityKey(e.target.value)}
      >
        {Object.keys(personalityProfiles).map(key => (
          <MenuItem key={key} value={key}>
            {personalityProfiles[key].displayName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  </Box>
);

export default PersonalitySelector;
