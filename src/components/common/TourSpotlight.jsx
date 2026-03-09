import { useEffect, useState, useCallback, useRef } from "react";
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiMousePointer,
} from "react-icons/fi";
import { useTour } from "../../context/TourContext";
import { IoIosSkipForward } from "react-icons/io";

export function TourSpotlight() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTour } =
    useTour();
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0,
    arrowDir: "top",
  });
  const [arrowPath, setArrowPath] = useState(null);
  const [isClickableStep, setIsClickableStep] = useState(false);
  const [isButtonStep, setIsButtonStep] = useState(false);
  const [isFormStep, setIsFormStep] = useState(false);
  const targetElementRef = useRef(null);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [triggerZoom, setTriggerZoom] = useState(false);
  const [pointerPosition, setPointerPosition] = useState({ top: 0, left: 0 });

  const currentStepData = steps[currentStep];

  const calculateArrowPath = useCallback(() => {
    if (!targetRect || !currentStepData) return null;

    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const placement = currentStepData.placement || "bottom";

    const tooltipCenterX = tooltipPosition.left + tooltipWidth / 2;
    const tooltipCenterY = tooltipPosition.top + tooltipHeight / 2;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Calculate the angle
    const angle = Math.atan2(
      targetCenterY - tooltipCenterY,
      targetCenterX - tooltipCenterX
    );

    // Starting point (edge of tooltip)
    const startDistance = 100;
    const startX = tooltipCenterX + Math.cos(angle) * startDistance;
    const startY = tooltipCenterY + Math.sin(angle) * startDistance;

    // Ending point (edge of target)
    const endDistance =
      Math.hypot(
        targetCenterX - tooltipCenterX,
        targetCenterY - tooltipCenterY
      ) - 60;
    const endX =
      tooltipCenterX + Math.cos(angle) * Math.max(endDistance, startDistance);
    const endY =
      tooltipCenterY + Math.sin(angle) * Math.max(endDistance, startDistance);

    // Arrow head
    const arrowHeadSize = 12;
    const angle1 = angle + Math.PI / 6;
    const angle2 = angle - Math.PI / 6;
    const headPoint1X = endX - Math.cos(angle1) * arrowHeadSize;
    const headPoint1Y = endY - Math.sin(angle1) * arrowHeadSize;
    const headPoint2X = endX - Math.cos(angle2) * arrowHeadSize;
    const headPoint2Y = endY - Math.sin(angle2) * arrowHeadSize;

    return {
      startX,
      startY,
      endX,
      endY,
      headPoint1X,
      headPoint1Y,
      headPoint2X,
      headPoint2Y,
    };
  }, [targetRect, tooltipPosition, currentStepData]);

  // <CHANGE> Enhanced updatePosition function with smart placement detection
  const updatePosition = useCallback(() => {
    if (!currentStepData) return;

    const element = document.querySelector(currentStepData.target);
    if (!element) return;

    targetElementRef.current = element;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    const rect = element.getBoundingClientRect();
    setTargetRect(rect);

    // <CHANGE> Detect mobile and adjust tooltip size accordingly
    const isMobile = window.innerWidth < 768;
    const tooltipWidth = isMobile ? 280 : 320;
    const tooltipHeight = isMobile ? 200 : 180;
    const gap = 12;
    const padding = 16;

    // <CHANGE> Calculate available space in each direction
    const spaceTop = rect.top;
    const spaceBottom = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    // <CHANGE> Determine best placement based on available space
    let placement = currentStepData.placement || "bottom";
    let hasEnoughSpace = false;

    const placements = [
      {
        name: "bottom",
        space: spaceBottom,
        minSpace: tooltipHeight + gap + 20,
      },
      { name: "top", space: spaceTop, minSpace: tooltipHeight + gap + 20 },
      { name: "right", space: spaceRight, minSpace: tooltipWidth + gap + 20 },
      { name: "left", space: spaceLeft, minSpace: tooltipWidth + gap + 20 },
    ];

    // <CHANGE> Sort placements by available space (descending) to find the best option
    const sortedPlacements = placements.sort((a, b) => b.space - a.space);

    for (const p of sortedPlacements) {
      if (p.space >= p.minSpace) {
        placement = p.name;
        hasEnoughSpace = true;
        break;
      }
    }

    // <CHANGE> If no placement has enough space, use the one with the most available space
    if (!hasEnoughSpace) {
      placement = sortedPlacements[0].name;
    }

    let top = 0;
    let left = 0;
    let arrowDir = "top";

    // <CHANGE> Position tooltip based on the selected optimal placement
    switch (placement) {
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        arrowDir = "bottom";
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        arrowDir = "top";
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        arrowDir = "right";
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        arrowDir = "left";
        break;
    }

    // <CHANGE> Apply viewport constraints to ensure tooltip and element stay visible
    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - tooltipHeight - padding)
    );
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - tooltipWidth - padding)
    );

    setTooltipPosition({ top, left, arrowDir });
  }, [currentStepData]);

  const handleTargetClick = useCallback(
    (e) => {
      if (isButtonStep) {
        nextStep();
      }
    },
    [isButtonStep, nextStep]
  );

  const updatePointerPosition = useCallback(() => {
    if (!targetRect) return;

    const time = Date.now() / 1000;
    const radius = 60;
    const angle = (time * 1.5) % (Math.PI * 2);

    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;

    const pointerX = centerX + Math.cos(angle) * radius - 12;
    const pointerY = centerY + Math.sin(angle) * radius - 12;

    setPointerPosition({ top: pointerY, left: pointerX });
  }, [targetRect]);

  useEffect(() => {
    if (isActive && currentStepData) {
      setIsTypingComplete(false);
      setTriggerZoom(false);

      const timer = setTimeout(() => {
        updatePosition();

        const element = document.querySelector(currentStepData.target);
        if (!element) return;

        const isClickable = currentStepData.target.includes("clickable");
        const isButton = currentStepData.target.includes("btn");
        const isForm = currentStepData.target.includes("clickable-form");

        setIsClickableStep(isClickable);
        setIsButtonStep(isButton);
        setIsFormStep(isForm);
        setTriggerZoom(true);

        if (isClickable) {
          const handleInput = (e) => {
            const value = e.target.value.trim();
            setIsTypingComplete(value.length >= 3);
          };

          element.addEventListener("input", handleInput);

          return () => {
            element.removeEventListener("input", handleInput);
          };
        }

        if (isButton) {
          element.addEventListener("click", handleTargetClick, true);
        }
      }, 150);

      // <CHANGE> Update position on window resize and scroll to maintain visibility
      const handleResize = () => {
        updatePosition();
      };

      const handleScroll = () => {
        updatePosition();
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleScroll);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleScroll);

        const element = document.querySelector(currentStepData.target);
        if (element) {
          element.removeEventListener("click", handleTargetClick, true);
        }
      };
    }
  }, [isActive, currentStepData, updatePosition, handleTargetClick]);

  useEffect(() => {
    if (!isActive || !targetRect) return;

    const animationFrame = setInterval(() => {
      updatePointerPosition();
    }, 30);

    return () => clearInterval(animationFrame);
  }, [isActive, targetRect, updatePointerPosition]);

  useEffect(() => {
    if (triggerZoom && targetRect && currentStepData) {
      setArrowPath(calculateArrowPath());
    }
  }, [
    triggerZoom,
    targetRect,
    tooltipPosition,
    currentStepData,
    calculateArrowPath,
  ]);

  if (!isActive || !currentStepData || !targetRect) return null;

  const isInteractiveStep = isClickableStep || isButtonStep;
  const storedFirstTime = localStorage.getItem("isFirstTimeLogin");

  return (
    <>
      {/* Backdrop with four parts around the target to allow interactions in the hole */}
      <div
        className="fixed top-0 left-0 right-0 z-[9998] bg-black/60 backdrop-blur-sm transition-all"
        style={{
          height: targetRect.top,
        }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[9998] bg-black/60 backdrop-blur-sm transition-all"
        style={{
          top: targetRect.bottom,
        }}
      />
      <div
        className="fixed top-0 bottom-0 left-0 z-[9998] bg-black/60 backdrop-blur-sm transition-all"
        style={{
          width: targetRect.left,
        }}
      />
      <div
        className="fixed top-0 bottom-0 right-0 z-[9998] bg-black/60 backdrop-blur-sm transition-all"
        style={{
          left: targetRect.right,
        }}
      />

      {/* Blocking overlay for non-interactive steps */}
      {!isInteractiveStep && (
        <div
          className="fixed z-[9997]"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      {/* Focus ring with zoom animation */}
      <div
        className={`fixed z-[9999] pointer-events-none transition-all duration-500 ${
          triggerZoom ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        style={{
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          border: "2px solid rgb(37 99 235)",
          borderRadius: "8px",
          boxShadow: `0 0 16px rgba(37,99,235,0.5), 0 0 32px ${
            triggerZoom ? "rgba(37,99,235,0.3)" : "rgba(37,99,235,0)"
          }`,
          transformOrigin: "center",
        }}
      />

      {/* Tooltip with arrow */}
      <div
        className={`fixed z-[10000] rounded-lg border bg-white p-4 md:p-6 shadow-2xl animate-in fade-in transition-all duration-500 ${
          triggerZoom ? "zoom-in-95 opacity-100" : "opacity-0"
        }`}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: window.innerWidth < 768 ? "280px" : "320px",
        }}
      >
        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-white border border-gray-200 rotate-45`}
          style={{
            ...(tooltipPosition.arrowDir === "top" && {
              top: "-6px",
              left: "calc(50% - 6px)",
              borderBottom: "none",
              borderRight: "none",
            }),
            ...(tooltipPosition.arrowDir === "bottom" && {
              bottom: "-6px",
              left: "calc(50% - 6px)",
              borderTop: "none",
              borderLeft: "none",
            }),
            ...(tooltipPosition.arrowDir === "left" && {
              left: "-6px",
              top: "calc(50% - 6px)",
              borderTop: "none",
              borderRight: "none",
            }),
            ...(tooltipPosition.arrowDir === "right" && {
              right: "-6px",
              top: "calc(50% - 6px)",
              borderBottom: "none",
              borderLeft: "none",
            }),
          }}
        />

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <h3 className="font-semibold text-base md:text-lg text-gray-900">
                {currentStepData.title}
              </h3>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                {currentStepData.content}
              </p>
              {isClickableStep && !isButtonStep && !isFormStep && (
                <p className="text-xs md:text-sm text-blue-600 font-medium">
                  Click on the highlighted element to continue.
                </p>
              )}
              {isButtonStep && (
                <p className="text-xs md:text-sm text-blue-600 font-medium">
                  Click the button to proceed to the next step.
                </p>
              )}
              {isFormStep && (
                <p className="text-xs md:text-sm text-blue-600 font-medium">
                  Finish filling out the form to move to the next step.
                </p>
              )}
            </div>
          </div>

          {/* Step navigation */}
          <div className="flex flex-col gap-2 items-center justify-between pt-2 border-t border-gray-200">
            {/* Progress dots */}
            <div className="relative w-full overflow-hidden">
              {/* {storedFirstTime !== "True" && (
              <button
                onClick={() => {
                  window.speechSynthesis.cancel();
                  skipTour();
                }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 transition"
              >
                <FiX className="h-4 w-4" />
              </button>
            )} */}
              {/* <button
              onClick={() => {
                window.speechSynthesis.cancel();
                skipTour();
              }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 transition"
            >
              <FiX className="h-4 w-4" />
            </button> */}
              <div
                className="flex items-center gap-2 px-1 py-1 transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(-${
                    Math.max(0, currentStep - 5) * 16
                  }px)`,
                }}
              >
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-2 flex-shrink-0 rounded-full transition-all duration-200 ${
                      index === currentStep
                        ? "bg-blue-600 scale-125"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* {currentStep > 0 && (
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    prevStep();
                  }}
                  className="flex items-center text-sm border border-gray-300 rounded px-2 py-1 hover:bg-gray-100 transition"
                >
                  <FiChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </button>
              )} */}
              {!isFormStep && (
                <button
                  onClick={() => {
                    nextStep();
                  }}
                  disabled={
                    (currentStepData.target.includes("clickable") &&
                      !isTypingComplete) ||
                    currentStepData.target.includes("btn")
                  }
                  className={`flex items-center text-sm rounded px-3 py-1 transition ${
                    (currentStepData.target.includes("clickable") &&
                      !isTypingComplete) ||
                    currentStepData.target.includes("btn")
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {currentStep === steps.length - 1 ? "Finish" : "Next"}
                  {currentStep < steps.length - 1 && (
                    <FiChevronRight className="h-4 w-4 ml-1" />
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  skipTour();
                }}
                className="flex items-center text-sm border border-gray-300 rounded px-2 py-1 hover:bg-gray-100 transition"
              >
                <IoIosSkipForward className="h-4 w-4 mr-1" />
                Skip
              </button>
            </div>
          </div>

          <div className="text-xs text-center text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
      </div>
    </>
  );
}
