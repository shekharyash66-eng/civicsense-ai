import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { PriorityWeights } from '../../types/civic';
import { calculatePriority } from '../../services/priorityEngine';
import { PriorityIndicator } from '../common/StatusBadge';
import {
  Sliders,
  Calculator,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

export const PrioritySettings: React.FC = () => {
  const { priorityWeights, updatePriorityWeights } = useCivic();

  // Local weights state
  const [weights, setWeights] = useState<PriorityWeights>({ ...priorityWeights });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Simulator state
  const [simSafety, setSimSafety] = useState(85);
  const [simSeverity, setSimSeverity] = useState(70);
  const [simPop, setSimPop] = useState(65);
  const [simTime, setSimTime] = useState(40);

  const sumWeights = weights.safety_risk + weights.severity + weights.population_impact + weights.time_unresolved;
  const isWeightSumValid = sumWeights === 100;

  const simResult = calculatePriority(simSafety, simSeverity, simPop, simTime, weights);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightSumValid) {
      setSaveError(`Weights must sum to exactly 100%. Current sum: ${sumWeights}%`);
      return;
    }
    setSaveError('');
    const ok = await updatePriorityWeights(weights);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleResetDefaults = async () => {
    const defaults = {
      safety_risk: 40,
      severity: 25,
      population_impact: 20,
      time_unresolved: 15,
    };
    setWeights(defaults);
    await updatePriorityWeights(defaults);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded mb-1">
          <Calculator className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Explainable Municipal Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          AI Priority Scoring Engine & Formula Calibration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure transparent weights, review factor models, and simulate priority calculations in real time.
        </p>
      </div>

      {/* Safety Protocol Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">Mandatory Public Safety Rules:</div>
          <p className="leading-relaxed text-amber-800 dark:text-amber-300">
            A numerical score never overrides verified emergency protocols. Explicitly dangerous reports
            (e.g., exposed live electrical wires, sinkhole fissures, bridge structural damage) are automatically
            flagged for urgent human review regardless of score.
          </p>
        </div>
      </div>

      {/* Formula & Weight Calibration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveWeights}
          className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-5 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Factor Weight Distribution</h2>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Defaults</span>
            </button>
          </div>

          {/* Sum Validation Indicator */}
          <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
            isWeightSumValid ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}>
            <span className="font-medium">Total Factor Weight Sum:</span>
            <span className="font-mono font-bold text-sm">
              {sumWeights}% {isWeightSumValid ? '✓ (Valid)' : '✗ (Must equal 100%)'}
            </span>
          </div>

          {/* Safety Risk Weight */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span>Safety Risk Weight</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{weights.safety_risk}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="70"
              value={weights.safety_risk}
              onChange={(e) => setWeights({ ...weights, safety_risk: Number(e.target.value) })}
              className="w-full"
            />
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Physical hazard to life, falls, vehicular collisions</div>
          </div>

          {/* Issue Severity Weight */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span>Issue Severity Weight</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{weights.severity}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              value={weights.severity}
              onChange={(e) => setWeights({ ...weights, severity: Number(e.target.value) })}
              className="w-full"
            />
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Degree of physical deterioration or structural damage</div>
          </div>

          {/* Population Impact Weight */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span>Population Impact Weight</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{weights.population_impact}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              value={weights.population_impact}
              onChange={(e) => setWeights({ ...weights, population_impact: Number(e.target.value) })}
              className="w-full"
            />
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Arterial roadways, transit corridors, hospitals, schools</div>
          </div>

          {/* Time Unresolved Weight */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span>Time Unresolved Weight</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{weights.time_unresolved}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              value={weights.time_unresolved}
              onChange={(e) => setWeights({ ...weights, time_unresolved: Number(e.target.value) })}
              className="w-full"
            />
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Automated SLA escalation penalty for aging open cases</div>
          </div>

          {saveError && <div className="text-xs text-red-600 dark:text-red-400 font-medium">{saveError}</div>}
          {saveSuccess && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              Weights updated successfully! Active complaints recomputed.
            </div>
          )}

          <button
            type="submit"
            disabled={!isWeightSumValid}
            className="w-full py-2.5 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-lg font-semibold text-xs shadow transition-colors disabled:opacity-50"
          >
            Apply & Re-Index Open Queue
          </button>
        </form>

        {/* Live Simulator & Dynamic Explanation Sandbox */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-5 text-xs">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Interactive Formula Simulator</h2>
            <span className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded">
              Live Test Bench
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1 text-slate-700 dark:text-slate-300">
                <span>Test Safety Risk (0-100):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{simSafety}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simSafety}
                onChange={(e) => setSimSafety(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 text-slate-700 dark:text-slate-300">
                <span>Test Severity (0-100):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{simSeverity}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simSeverity}
                onChange={(e) => setSimSeverity(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 text-slate-700 dark:text-slate-300">
                <span>Test Population Impact (0-100):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{simPop}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simPop}
                onChange={(e) => setSimPop(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 text-slate-700 dark:text-slate-300">
                <span>Test Time Unresolved (0-100):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{simTime}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simTime}
                onChange={(e) => setSimTime(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Computed Score Output */}
          <div className="p-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Computed Priority:</span>
              <PriorityIndicator level={simResult.level} score={simResult.score} />
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono pt-2 border-t border-slate-800 dark:border-slate-700">
              <div>
                <div className="text-slate-400">Safety</div>
                <div className="text-red-400 font-bold">+{simResult.safety_component}</div>
              </div>
              <div>
                <div className="text-slate-400">Severity</div>
                <div className="text-orange-400 font-bold">+{simResult.severity_component}</div>
              </div>
              <div>
                <div className="text-slate-400">Population</div>
                <div className="text-amber-400 font-bold">+{simResult.population_component}</div>
              </div>
              <div>
                <div className="text-slate-400">Time</div>
                <div className="text-teal-400 font-bold">+{simResult.time_component}</div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-800 dark:bg-slate-900 text-xs text-slate-200 italic font-sans leading-relaxed">
              "{simResult.explanation}"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
