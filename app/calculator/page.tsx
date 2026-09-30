'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CalculatorPage() {
  const [currentInput, setCurrentInput] = useState('0');
  const [previousInput, setPreviousInput] = useState('');
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [shouldResetDisplay, setShouldResetDisplay] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [secretPin, setSecretPin] = useState('9999');
  const [degClicks, setDegClicks] = useState(0);

  const triggerStealthEmergency = async () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);

    try {
      await fetch('/api/trigger-sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+923001234567',
          triggerType: 'PANIC_KEYWORD',
          reason: 'Stealth SOS triggered via Calculator disguise',
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const inputDigit = (digit: string) => {
    if (currentInput === '0' || shouldResetDisplay) {
      setCurrentInput(digit);
      setShouldResetDisplay(false);
    } else {
      setCurrentInput((prev) => prev + digit);
    }
  };

  const inputDot = () => {
    if (!currentInput.includes('.')) {
      setCurrentInput((prev) => prev + '.');
    }
  };

  const clearDisplay = () => {
    setCurrentInput('0');
    setPreviousInput('');
    setCurrentOperator(null);
  };

  const setOperator = (op: string) => {
    calculateResult();
    setPreviousInput(currentInput);
    setCurrentOperator(op);
    setShouldResetDisplay(true);
  };

  const calculateResult = () => {
    if (currentInput === secretPin || currentInput === '1122') {
      triggerStealthEmergency();
      clearDisplay();
      return;
    }

    if (!currentOperator || shouldResetDisplay) return;

    const prev = parseFloat(previousInput);
    const current = parseFloat(currentInput);
    let result = 0;

    switch (currentOperator) {
      case '+': result = prev + current; break;
      case '−': result = prev - current; break;
      case '×': result = prev * current; break;
      case '÷': result = current !== 0 ? prev / current : 0; break;
      default: return;
    }

    setCurrentInput(result.toString());
    setCurrentOperator(null);
    setShouldResetDisplay(true);
  };

  const handleDegClick = () => {
    const newCount = degClicks + 1;
    setDegClicks(newCount);
    if (newCount >= 3) {
      setShowSettings(true);
      setDegClicks(0);
    }
    setTimeout(() => setDegClicks(0), 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black select-none">
      <div className="w-full max-w-sm bg-neutral-950 rounded-[44px] p-6 shadow-2xl border border-neutral-800 flex flex-col justify-between min-h-[690px] relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 px-2">
          <span>10:04</span>
          <button onClick={handleDegClick} className="font-mono text-[10px] text-neutral-600 hover:text-neutral-400">
            DEG
          </button>
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <div className="w-4 h-2 border border-neutral-500 rounded-sm p-0.5">
              <div className="bg-neutral-400 h-full w-3/4"></div>
            </div>
          </div>
        </div>

        {/* Toast */}
        {showToast && (
          <div className="absolute top-12 left-6 right-6 bg-neutral-900/95 border border-pink-500/40 rounded-2xl p-3 shadow-xl backdrop-blur-md z-30">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse"></div>
              <div className="text-xs">
                <p className="font-bold text-pink-400">Beti AI Sentinel Active</p>
                <p className="text-neutral-300 text-[11px]">Silent Emergency Broadcast sent to Family WhatsApp.</p>
              </div>
            </div>
          </div>
        )}

        {/* Display */}
        <div className="my-auto px-3 text-right">
          <div className="text-sm text-neutral-500 min-h-[20px] font-mono">
            {previousInput} {currentOperator}
          </div>
          <div className="text-6xl font-light tracking-tight text-white overflow-hidden text-ellipsis whitespace-nowrap">
            {currentInput}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-3.5 pb-2">
          <button onClick={clearDisplay} className="h-16 rounded-full bg-neutral-400 text-black font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">AC</button>
          <button onClick={() => setCurrentInput((prev) => (parseFloat(prev) * -1).toString())} className="h-16 rounded-full bg-neutral-400 text-black font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">±</button>
          <button onClick={() => setCurrentInput((prev) => (parseFloat(prev) / 100).toString())} className="h-16 rounded-full bg-neutral-400 text-black font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">%</button>
          <button onClick={() => setOperator('÷')} className="h-16 rounded-full bg-amber-500 text-white font-medium text-3xl active:scale-95 transition-transform flex items-center justify-center">÷</button>

          <button onClick={() => inputDigit('7')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">7</button>
          <button onClick={() => inputDigit('8')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">8</button>
          <button onClick={() => inputDigit('9')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">9</button>
          <button onClick={() => setOperator('×')} className="h-16 rounded-full bg-amber-500 text-white font-medium text-3xl active:scale-95 transition-transform flex items-center justify-center">×</button>

          <button onClick={() => inputDigit('4')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">4</button>
          <button onClick={() => inputDigit('5')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">5</button>
          <button onClick={() => inputDigit('6')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">6</button>
          <button onClick={() => setOperator('−')} className="h-16 rounded-full bg-amber-500 text-white font-medium text-3xl active:scale-95 transition-transform flex items-center justify-center">−</button>

          <button onClick={() => inputDigit('1')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">1</button>
          <button onClick={() => inputDigit('2')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">2</button>
          <button onClick={() => inputDigit('3')} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">3</button>
          <button onClick={() => setOperator('+')} className="h-16 rounded-full bg-amber-500 text-white font-medium text-3xl active:scale-95 transition-transform flex items-center justify-center">+</button>

          <button onClick={() => inputDigit('0')} className="h-16 col-span-2 rounded-full bg-neutral-800 text-white font-medium text-2xl pl-7 active:scale-95 transition-transform flex items-center justify-start">0</button>
          <button onClick={inputDot} className="h-16 rounded-full bg-neutral-800 text-white font-medium text-2xl active:scale-95 transition-transform flex items-center justify-center">.</button>
          <button onClick={calculateResult} className="h-16 rounded-full bg-amber-500 text-white font-medium text-3xl active:scale-95 transition-transform flex items-center justify-center">=</button>
        </div>

        <div className="text-center pt-2 flex items-center justify-between text-[11px] text-neutral-500">
          <span>🤫 Type <code className="text-neutral-400">9999=</code> for SOS</span>
          <Link href="/" className="hover:text-white">Exit →</Link>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
              <h3 className="font-bold text-sm text-pink-400">Beti AI Stealth Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-neutral-400 hover:text-white text-lg">✕</button>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Secret Panic Code (PIN):</label>
              <input
                type="text"
                value={secretPin}
                onChange={(e) => setSecretPin(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-2.5 text-white font-mono"
              />
            </div>
            <button
              onClick={() => {
                setShowSettings(false);
                alert('Settings saved!');
              }}
              className="w-full py-3 bg-pink-600 rounded-xl text-white font-bold"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
