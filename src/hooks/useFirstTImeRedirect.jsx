import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function useFirstTimeRedirect({
  firstTimeValue,
  redirectTo = "/initial-setup",
  startValue = 3,
}) {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(startValue);
  const navigate = useNavigate();

  useEffect(() => {
    if (firstTimeValue === "True" || firstTimeValue === 1) {
      setShow(true);
      let counter = startValue;

      const interval = setInterval(() => {
        counter -= 1;
        setCountdown(counter);

        if (counter <= 0) {
          clearInterval(interval);
          setShow(false);
          navigate(redirectTo);
          localStorage.setItem("nextTutorial", "True");
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [firstTimeValue, navigate, redirectTo, startValue]);

  return { show, countdown };
}
