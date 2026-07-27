"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFloodData } from "@/context/FloodDataContext";
import { AlertTriangle, Square, RefreshCw, Zap, ShieldAlert, Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function GlobalSimulationBanner() {
  const { mode, stormSimulationActive, simulationMeta, stopSimulation } = useFloodData();
  const [stopping, setStopping] = useState(false);
  const queryClient = useQueryClient();

  if (!stormSimulationActive && mode !== "SIMULATION") {
    return null;
  }

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopSimulation();
      await queryClient.invalidateQueries();
    } catch (err) {
      console.error("Failed to stop simulation:", err);
    } finally {
      setStopping(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg border-b border-orange-500/50 relative z-30 overflow-hidden px-4 py-2.5"
      >
        {/* Subtle background wave animation */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent)] pointer-events-none" />

        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Main Title Badge */}
          <div className="flex items-center gap-2.5 font-bold tracking-wide">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-amber-200 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-white relative" />
            </div>
            <span className="text-sm font-heading font-extrabold uppercase flex items-center gap-1.5 text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-200 animate-bounce" />
              🟠 STORM SIMULATION ACTIVE
            </span>
          </div>

          {/* Scenario Metadata Grid */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-amber-50">
            <div>
              <span className="text-amber-200/80 font-sans">Scenario:</span>{" "}
              <strong className="text-white font-bold">{simulationMeta?.scenario || "Cyclone Michaung"}</strong>
            </div>
            <div className="hidden sm:inline text-amber-300/40">|</div>
            <div>
              <span className="text-amber-200/80 font-sans">Category:</span>{" "}
              <strong className="text-white font-bold">{simulationMeta?.category || "Very Severe Cyclonic Storm"}</strong>
            </div>
            <div className="hidden md:inline text-amber-300/40">|</div>
            <div>
              <span className="text-amber-200/80 font-sans">Started:</span>{" "}
              <strong className="text-white font-bold">{simulationMeta?.startedAt || "22:45"}</strong>
            </div>
            <div className="hidden md:inline text-amber-300/40">|</div>
            <div>
              <span className="text-amber-200/80 font-sans">Duration:</span>{" "}
              <strong className="text-white font-bold">{simulationMeta?.durationMinutes || 30} mins</strong>
            </div>
            <div className="hidden lg:inline text-amber-300/40">|</div>
            <div>
              <span className="text-amber-200/80 font-sans">ID:</span>{" "}
              <strong className="text-amber-200 bg-black/20 px-1.5 py-0.5 rounded border border-amber-300/20">{simulationMeta?.simulationId || "SIM-20260727-001"}</strong>
            </div>
            <div className="hidden xl:inline text-amber-300/40">|</div>
            <div className="hidden xl:block">
              <span className="text-amber-200/80 font-sans">Prediction Source:</span>{" "}
              <span className="text-white font-semibold">{simulationMeta?.predictionSource || "Simulated Weather Inputs"}</span>
            </div>
          </div>

          {/* Stop Simulation Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleStop}
              disabled={stopping}
              className="px-3.5 py-1.5 rounded-lg bg-white text-orange-700 font-heading font-bold text-xs hover:bg-amber-50 active:scale-95 transition-all shadow border border-amber-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {stopping ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Restoring Live ETL...
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 fill-orange-700 text-orange-700" />
                  Stop Simulation
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
