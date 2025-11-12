
import React from 'react';
import { ModuleInfo, ChannelData } from '../types';

interface InteractiveGUIProps {
  moduleInfo: ModuleInfo;
  channelData: ChannelData[];
}

export const InteractiveGUI: React.FC<InteractiveGUIProps> = ({ moduleInfo, channelData }) => {
  return (
    <div
      className="relative bg-cover bg-center w-full h-[768px]"
      style={{ backgroundImage: "url('/xm-gui.png')" }}
    >
      {/* Step Sequencer Lights */}
      <div className="absolute top-[452px] left-[calc(50%-515px)] flex gap-[10.5px]">
        {Array.from({ length: 16 }).map((_, i) => {
          const isActive = moduleInfo.row % 16 === i;
          return (
            <div
              key={i}
              id={`step-light-${i}`}
              className="w-[54px] h-[54px] transition-all duration-100"
              style={{
                backgroundColor: isActive ? 'rgba(255, 223, 186, 0.8)' : 'rgba(255, 223, 186, 0.1)',
                boxShadow: isActive ? '0 0 20px 8px rgba(255, 223, 186, 0.5)' : 'none',
                border: '1px solid rgba(255, 223, 186, 0.4)',
              }}
            ></div>
          );
        })}
      </div>
      {/* VU Meters */}
      <div className="absolute top-[210px] left-[calc(50%-450px)] flex gap-[20px]">
        {channelData.map((channel, i) => {
          const isActive = channel.isActive;
          return (
            <div key={i} className="w-[10px] h-[50px] bg-gray-800 border-2 border-gray-600 rounded-sm relative">
              <div
                className="w-full bg-green-500"
                style={{
                  height: `${channel.vu * 100}%`,
                  backgroundColor: `hsl(${100 - (channel.vu * 100)}, 100%, 50%)`,
                  boxShadow: `0 0 10px 3px hsl(${100 - (channel.vu * 100)}, 100%, 50%)`,
                }}
              ></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
