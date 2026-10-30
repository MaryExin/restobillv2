import { useEffect, useState } from "react";
import { fetchMenuProductVariants } from "../utils/menuProductVariantFetch.js";

const IDLE_RESULT = { group: null, key: "", variants: [], error: "", isLoading: false };

export default function useMenuProductVariants({
  group, apiHost, categoryCode, unitCode, salesType, mapProduct,
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(IDLE_RESULT);
  const requestKey = JSON.stringify([
    group?.familyKey, group?.item_name, apiHost, categoryCode, unitCode, salesType, attempt,
  ]);

  useEffect(() => {
    if (!group) {
      setResult(IDLE_RESULT);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setResult({ group, key: requestKey, variants: [], error: "", isLoading: true });

    const load = async () => {
      try {
        if (!apiHost || !categoryCode || !unitCode || !salesType) {
          throw new Error("Select a service type to load product options.");
        }
        const products = await fetchMenuProductVariants({
          group, apiHost, categoryCode, unitCode, salesType, signal: controller.signal,
        });
        if (!disposed) {
          setResult({
            group, key: requestKey, variants: products.map(mapProduct), error: "", isLoading: false,
          });
        }
      } catch (error) {
        if (!disposed) {
          setResult({
            group, key: requestKey, variants: [], isLoading: false,
            error: controller.signal.aborted
              ? "Loading product options timed out. Please try again."
              : error.message || "Could not load product options. Please try again.",
          });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };
    load();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [group, apiHost, categoryCode, unitCode, salesType, mapProduct, requestKey]);

  // Each modal opening has its own group object. Do not expose a previous
  // opening's prices while React is waiting to run the new request effect.
  const current = group && result.group === group && result.key === requestKey
    ? result
    : { variants: [], error: "", isLoading: Boolean(group) };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}
