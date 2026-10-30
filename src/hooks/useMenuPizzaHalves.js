import { useEffect, useState } from "react";
import { fetchMenuCombinationHalves } from "../utils/menuProductVariantFetch.js";

const IDLE_RESULT = { group: null, key: "", products: [], error: "", isLoading: false };
const identity = (product) => product;

// Both pizza and platter combinations load real Half products in the active
// pricing context. Keep the original module path for existing consumers.
export default function useMenuCombinationHalves({
  group, apiHost, categoryCode, unitCode, salesType, mapProduct = identity,
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(IDLE_RESULT);
  const requestKey = JSON.stringify([
    group?.familyKey, group?.item_category, apiHost, categoryCode, unitCode, salesType, attempt,
  ]);

  useEffect(() => {
    if (!group) {
      setResult(IDLE_RESULT);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setResult({ group, key: requestKey, products: [], error: "", isLoading: true });

    const load = async () => {
      try {
        if (!apiHost || !categoryCode || !unitCode || !salesType) {
          throw new Error("Select a service type to load combination flavors.");
        }
        const products = await fetchMenuCombinationHalves({
          group, apiHost, categoryCode, unitCode, salesType, signal: controller.signal,
        });
        if (!disposed) {
          setResult({
            group, key: requestKey, products: products.map(mapProduct), error: "", isLoading: false,
          });
        }
      } catch (error) {
        if (!disposed) {
          setResult({
            group, key: requestKey, products: [], isLoading: false,
            error: controller.signal.aborted
              ? "Loading combination flavors timed out. Please try again."
              : error.message || "Could not load combination flavors. Please try again.",
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

  // Hide prices immediately on a new opening, retry, or changed pricing context,
  // including the render before the replacement effect has run.
  const current = group && result.group === group && result.key === requestKey
    ? result
    : { products: [], error: "", isLoading: Boolean(group) };
  return { products: current.products, isLoading: current.isLoading, error: current.error,
    retry: () => setAttempt((value) => value + 1) };
}
