import { useState } from 'react';
import '../styles/RoomSelector.css'

function RoomSelector({ rooms, selectedRoom, onSelectRoom }) {
  const [expandedGroups, setExpandedGroups] = useState({});

  // Group rooms by their group property
  const groupedRooms = Object.entries(rooms).reduce((acc, [key, room]) => {
    const group = room.group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push({ key, ...room });
    return acc;
  }, {});

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  return (
    <div className="room-selector">
      <div className="room-selector-header">
        <h2>Rooms</h2>
      </div>
      <div className="room-list">
        {Object.entries(groupedRooms).map(([groupName, roomList]) => (
          <div key={groupName} className="room-group">
            <button
              className="group-toggle"
              onClick={() => toggleGroup(groupName)}
            >
              <span className="toggle-icon">
                {expandedGroups[groupName] ? '▼' : '▶'}
              </span>
              <span className="group-name">{groupName}</span>
              <span className="group-count">{roomList.length}</span>
            </button>
            {expandedGroups[groupName] && (
              <div className="room-items">
                {roomList.map(room => (
                  <button
                    key={room.key}
                    className={`room-item ${selectedRoom === room.key ? 'active' : ''}`}
                    onClick={() => onSelectRoom(room.key)}
                  >
                    <span className="room-label">{room.label}</span>
                    <span className="booth-count">
                      {room.booths?.length || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoomSelector;
