import React from 'react';

const StatusDisplay = ({ statusMessage }) => {
  // This component is specifically for the global status message
  // that was previously in the TextGeneration section but is more general.
  // The TextGeneration component can have its own, more specific status if needed.
  return (
    <div
      id="globalStatusMessage" // Changed ID to be more generic
      style={{
        fontStyle: 'italic',
        marginBottom: '10px',
        padding: '10px',
        backgroundColor: '#f0f0f0',
        border: '1px solid #d0d0d0',
        borderRadius: '4px',
        textAlign: 'center',
      }}
    >
      {statusMessage}
    </div>
  );
};

export default StatusDisplay;
