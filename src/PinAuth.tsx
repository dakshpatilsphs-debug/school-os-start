import React, { useState, useCallback } from 'react';
import { FiLock, FiAlertCircle, FiCheck, FiKey, FiSend } from 'react-icons/fi';

interface PinAuthProps {
  pin: string;
  onUnlock: () => void;
  onChangePin?: (newPin: string) => void;
}

export const PinAuth: React.FC<PinAuthProps> = ({ pin, onUnlock, onChangePin }) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changePinError, setChangePinError] = useState(false);
  const [changingPin, setChangingPin] = useState(false);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setEnteredPin(val);
    setError(false);
  };

  const handleUnlock = async () => {
    if (enteredPin.length !== 4) {
      setError(true);
      return;
    }
    setUnlocking(true);
    // Simulate slight delay for UX
    await new Promise(r => setTimeout(r, 400));
    if (enteredPin === pin) {
      onUnlock();
    } else {
      setError(true);
      setEnteredPin('');
    }
    setUnlocking(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleUnlock();
  };

  const handleChangePin = async () => {
    if (!currentPin || currentPin !== pin) {
      setChangePinError(true);
      return;
    }
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setChangePinError(true);
      return;
    }
    if (newPin !== confirmPin) {
      setChangePinError(true);
      return;
    }
    setChangingPin(true);
    await new Promise(r => setTimeout(r, 400));
    if (onChangePin) {
      onChangePin(newPin);
    }
    setShowChangePin(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setChangePinError(false);
    setChangingPin(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a]">
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {!showChangePin ? (
          <>
            <div className="flex items-center justify-center mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                <FiLock size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-2">School Management</h2>
            <p className="text-gray-400 text-center mb-8">Enter PIN to access the system</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">PIN Code</label>
                <input
                  type="password"
                  maxLength={4}
                  value={enteredPin}
                  onChange={handlePinChange}
                  onKeyDown={handleKeyPress}
                  autoComplete="off"
                  className="w-full p-4 bg-gray-800 border border-gray-600 rounded-xl text-white text-2xl font-mono text-center focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="••••"
                />
                {error && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <FiAlertCircle size={12} /> Incorrect PIN
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleUnlock}
                  disabled={unlocking || enteredPin.length !== 4}
                  className={`w-full py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50 ${
                    unlocking
                      ? 'bg-gray-600'
                      : enteredPin.length === 4
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/30'
                        : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {unlocking ? <FiSend size={16} className="mr-2" /> : ''} Unlock
                </button>
                {onChangePin && (
                  <button
                    onClick={() => setShowChangePin(true)}
                    className="w-full py-4 rounded-xl font-bold text-gray-400 border border-gray-600 hover:bg-gray-700 transition-all"
                  >
                    Change PIN
                  </button>
                )}
              </div>

              <p className="text-[11px] text-gray-500 text-center mt-4">
                Default PIN: 1809
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center mb-6">
              <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-400">
                <FiKey size={32} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white text-center mb-2">Change PIN</h2>
            <p className="text-gray-400 text-center mb-8">Set a new 4-digit PIN</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Current PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={currentPin}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCurrentPin(val);
                    setChangePinError(false);
                  }}
                  autoComplete="off"
                  className="w-full p-4 bg-gray-800 border border-gray-600 rounded-xl text-white text-2xl font-mono text-center focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">New PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNewPin(val);
                    setChangePinError(false);
                  }}
                  autoComplete="off"
                  className="w-full p-4 bg-gray-800 border border-gray-600 rounded-xl text-white text-2xl font-mono text-center focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Confirm PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPin}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfirmPin(val);
                    setChangePinError(false);
                  }}
                  autoComplete="off"
                  className="w-full p-4 bg-gray-800 border border-gray-600 rounded-xl text-white text-2xl font-mono text-center focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="••••"
                />
              </div>
              {changePinError && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <FiAlertCircle size={12} /> Invalid PIN or PINs do not match
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setShowChangePin(false)}
                  className="w-full py-3 rounded-xl font-bold text-gray-400 border border-gray-600 hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePin}
                  disabled={changingPin}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50 ${
                    changingPin ? 'bg-gray-600' : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 shadow-lg shadow-yellow-500/30'
                  }`}
                >
                  {changingPin ? <FiCheck size={16} className="mr-2" /> : ''} Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PinAuth;
