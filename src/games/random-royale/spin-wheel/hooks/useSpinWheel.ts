"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { soundManager } from "@/platform/audio";
import {
  MAX_PARTICIPANTS,
  SPIN_DURATION_MS,
  SPIN_MOTION_CONFIG,
  WHEEL_COLORS,
} from "../config";
import type { Participant, SpinPlan, WheelSegment } from "../types";
import {
  addParticipant as addParticipantUtil,
  removeParticipant as removeParticipantUtil,
} from "../logic/participantUtils";
import {
  calculateTargetRotation,
  completeSpin,
  getSegmentAtPointer,
  requestSpin,
} from "../logic/spinCalculation";
import {
  getSegmentCenterAngle,
  getWheelSegmentPath,
} from "../logic/wheelGeometry";

export interface UseSpinWheelReturn {
  participants: Participant[];
  name: string;
  setName: (name: string) => void;
  rotation: number;
  spinDuration: number;
  isSpinning: boolean;
  winner: Participant | null;
  hasSpun: boolean;
  segments: WheelSegment[];
  canSpin: boolean;
  isFull: boolean;
  addDisabled: boolean;
  handleAdd: (event?: FormEvent<HTMLFormElement>) => void;
  handleRemove: (id: string) => void;
  handleClear: () => void;
  handleReset: () => void;
  handleSpin: () => void;
  handleSpinEnd: (propertyName: string) => void;
}

export function useSpinWheel(initialParticipants: Participant[] = []): UseSpinWheelReturn {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [name, setName] = useState("");
  const [rotation, setRotation] = useState(0);
  const [spinDuration, setSpinDuration] = useState<number>(SPIN_DURATION_MS);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [hasSpun, setHasSpun] = useState(false);

  const sequence = useRef(initialParticipants.length);
  const spinningLock = useRef(false);
  const pendingPlan = useRef<SpinPlan | null>(null);

  useEffect(() => () => {
    spinningLock.current = false;
    pendingPlan.current = null;
    soundManager.stopSpinTicks();
  }, []);

  const segments = useMemo(
    () =>
      participants.map((participant, index) => ({
        ...participant,
        color: WHEEL_COLORS[index % WHEEL_COLORS.length],
        path: getWheelSegmentPath(index, participants.length),
        angle: getSegmentCenterAngle(index, participants.length),
      })),
    [participants]
  );

  const handleAdd = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isSpinning || spinningLock.current) return;

    const nextSequence = sequence.current + 1;
    const updated = addParticipantUtil(
      participants,
      name,
      `participant-${nextSequence}`
    );
    if (!updated) return;

    sequence.current = nextSequence;
    setParticipants(updated);
    setName("");
    setWinner(null);
    setHasSpun(false);
  };

  const handleRemove = (id: string) => {
    if (isSpinning || spinningLock.current) return;
    setParticipants((current) => removeParticipantUtil(current, id));
    setWinner(null);
    setHasSpun(false);
  };

  const handleClear = () => {
    if (isSpinning || spinningLock.current) return;
    setParticipants([]);
    setWinner(null);
    setHasSpun(false);
  };

  const handleReset = () => {
    if (spinningLock.current) return;
    soundManager.stopSpinTicks();
    setWinner(null);
    setHasSpun(false);
    setRotation(0);
  };

  const handleSpin = () => {
    if (spinningLock.current || participants.length === 0) return;
    const plan = requestSpin(spinningLock.current, participants, rotation);
    if (!plan) return;

    spinningLock.current = true;
    pendingPlan.current = plan;
    soundManager.stopSpinTicks();

    // The wheel does not begin until every tick is decoded and the user-gesture
    // AudioContext resume request has completed, preventing a cold first tick.
    void soundManager.prepareSpinTicks().finally(() => {
      if (!spinningLock.current || pendingPlan.current !== plan) return;

      // Timing variation changes only the presentation; winner selection is already complete.
      setSpinDuration(
        SPIN_DURATION_MS +
          Math.floor(Math.random() * (SPIN_MOTION_CONFIG.durationVariationMs + 1))
      );
      setWinner(null);
      setHasSpun(false);
      setIsSpinning(true);
      setRotation(plan.targetRotation);
    });
  };

  const handleSpinEnd = useCallback((propertyName: string) => {
    if (propertyName !== "transform" || !spinningLock.current) return;
    const plan = pendingPlan.current;
    if (!plan) return;

    // Keep the visual target and chosen participant coupled by index
    if (getSegmentAtPointer(rotation, participants.length) !== plan.winnerIndex) {
      setRotation(
        calculateTargetRotation(rotation, plan.winnerIndex, participants.length, 1)
      );
      return;
    }

    pendingPlan.current = null;
    spinningLock.current = false;
    setIsSpinning(false);
    setHasSpun(true);
    setWinner(completeSpin(plan));
  }, [participants.length, rotation]);

  const canSpin = participants.length > 0 && !isSpinning;
  const isFull = participants.length >= MAX_PARTICIPANTS;
  const addDisabled = isSpinning || isFull;

  return {
    participants,
    name,
    setName,
    rotation,
    spinDuration,
    isSpinning,
    winner,
    hasSpun,
    segments,
    canSpin,
    isFull,
    addDisabled,
    handleAdd,
    handleRemove,
    handleClear,
    handleReset,
    handleSpin,
    handleSpinEnd,
  };
}
