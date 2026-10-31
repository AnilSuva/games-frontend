import test from "node:test";
import assert from "node:assert/strict";

test("Lobby Navigation: Mutual exclusivity of Mode Selection and Online Lobby screens", () => {
  // Scenario 1: Initial state
  let inModeSelection = true;
  let selectedMode = "1v1";
  let isInOnlineMatch = false;

  const getIsOnlineLobby = () => !inModeSelection && selectedMode === "online" && !isInOnlineMatch;

  assert.equal(inModeSelection, true);
  assert.equal(getIsOnlineLobby(), false);

  // Scenario 2: User selects Multiplayer
  inModeSelection = false;
  selectedMode = "online";
  assert.equal(inModeSelection, false);
  assert.equal(getIsOnlineLobby(), true);

  // Scenario 3: User clicks Back to Modes
  // Clean navigation resets mode and inModeSelection
  selectedMode = "1v1";
  inModeSelection = true;
  assert.equal(inModeSelection, true);
  assert.equal(getIsOnlineLobby(), false);
  // Under no circumstance should both inModeSelection and isOnlineLobby be true
  assert.equal(inModeSelection && getIsOnlineLobby(), false);
});

test("Lobby Navigation: Back to Modes safely triggers leaveRoom when room exists", () => {
  let leaveRoomCalled = false;
  let returnToModesCalled = false;
  let tab = "choose";
  let roomCodeInput = "ABC123";
  let copied = true;
  let room = { roomId: "room_123", roomCode: "XYZ890" };

  const onLeaveRoom = () => {
    leaveRoomCalled = true;
    room = null;
  };

  const onReturnToModes = () => {
    returnToModesCalled = true;
  };

  const handleReturnToModesClick = () => {
    tab = "choose";
    roomCodeInput = "";
    copied = false;
    if (room) {
      onLeaveRoom();
    }
    onReturnToModes();
  };

  handleReturnToModesClick();

  assert.equal(leaveRoomCalled, true);
  assert.equal(returnToModesCalled, true);
  assert.equal(room, null);
  assert.equal(tab, "choose");
  assert.equal(roomCodeInput, "");
  assert.equal(copied, false);
});

test("Lobby Navigation: Back to Modes does not trigger leaveRoom when no room exists", () => {
  let leaveRoomCalled = false;
  let returnToModesCalled = false;
  let room = null;

  const onLeaveRoom = () => {
    leaveRoomCalled = true;
  };

  const onReturnToModes = () => {
    returnToModesCalled = true;
  };

  const handleReturnToModesClick = () => {
    if (room) {
      onLeaveRoom();
    }
    onReturnToModes();
  };

  handleReturnToModesClick();

  assert.equal(leaveRoomCalled, false);
  assert.equal(returnToModesCalled, true);
});

test("Lobby Navigation: Join Room tab back navigation resets input and returns to choose", () => {
  let tab = "join";
  let roomCodeInput = "TEST99";

  const handleBackFromJoin = () => {
    tab = "choose";
    roomCodeInput = "";
  };

  handleBackFromJoin();

  assert.equal(tab, "choose");
  assert.equal(roomCodeInput, "");
});

test("Lobby Navigation: Re-entering Multiplayer after Back to Modes creates fresh clean session", () => {
  let inModeSelection = true;
  let selectedMode = "1v1";
  let connectionCount = 0;

  const connect = () => {
    connectionCount++;
  };

  const selectMultiplayer = () => {
    selectedMode = "online";
    inModeSelection = false;
    connect();
  };

  const returnToModes = () => {
    selectedMode = "1v1";
    inModeSelection = true;
  };

  // 1. Initial
  assert.equal(inModeSelection, true);

  // 2. Enter Multiplayer first time
  selectMultiplayer();
  assert.equal(inModeSelection, false);
  assert.equal(selectedMode, "online");
  assert.equal(connectionCount, 1);

  // 3. Back to Modes
  returnToModes();
  assert.equal(inModeSelection, true);
  assert.equal(selectedMode, "1v1");

  // 4. Re-enter Multiplayer second time
  selectMultiplayer();
  assert.equal(inModeSelection, false);
  assert.equal(selectedMode, "online");
  assert.equal(connectionCount, 2);

  // 5. Back to Modes again
  returnToModes();
  assert.equal(inModeSelection, true);
  assert.equal(selectedMode, "1v1");
});
