import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

//add clickable on data-tour name to make it clickable

const TourContext = createContext();

export function TourProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState([]);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  // ✅ Load "seen" flag
  useEffect(() => {
    const seen = localStorage.getItem("tour-completed");
    setHasSeenTour(seen === "true");
  }, []);

  // ✅ Start a tour (pass steps array)
  const startTour = useCallback((tourSteps) => {
    if (!tourSteps || !tourSteps.length) return;
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  // ✅ Move to next step, and trigger step.onNext if defined
  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      const current = steps[currentStep];

      // Run optional per-step logic
      if (typeof current?.onNext === "function") {
        current.onNext();
      }

      setCurrentStep((prev) => prev + 1);
    } else {
      endTour();
    }
  }, [currentStep, steps]);

  // ✅ Move to previous step, and trigger step.onPrev if defined
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const current = steps[currentStep];

      if (typeof current?.onPrev === "function") {
        current.onPrev();
      }

      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep, steps]);

  // ✅ Skip or end the tour
  const skipTour = useCallback(() => {
    localStorage.setItem("tour-completed", "true");
    setIsActive(false);
    setCurrentStep(0);
    setHasSeenTour(true);
  }, []);

  const endTour = useCallback(() => {
    const lastStep = steps[steps.length - 1];
    if (typeof lastStep?.onFinish === "function") {
      lastStep.onFinish();
    }

    localStorage.setItem("tour-completed", "true");
    setIsActive(false);
    setCurrentStep(0);
    setHasSeenTour(true);
  }, [steps]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        endTour,
        hasSeenTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
