import { useEffect, useState } from "react";
import { fetchCoffeeAddonOptions } from "../utils/menuCoffeeAddons.js";

const IDLE_RESULT = { sourceProduct: null, key: "", product: null, addons: [], error: "", isLoading: false };
const identity = (product) => product;

export default function useCoffeeAddonOptions({
  product, apiHost, categoryCode, unitCode, salesType, mapProduct = identity,
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(IDLE_RESULT);
  const requestKey = JSON.stringify([
    product?.product_id, product?.item_name, product?.item_category,
    apiHost, categoryCode, unitCode, salesType, attempt,
  ]);

  useEffect(() => {
    if (!product) {
      setResult(IDLE_RESULT);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setResult({ sourceProduct: product, key: requestKey, product: null, addons: [], error: "", isLoading: true });

    const load = async () => {
      try {
        if (!apiHost || !categoryCode || !unitCode || !salesType) {
          throw new Error("Select a service type to load coffee options.");
        }
        const options = await fetchCoffeeAddonOptions({
          product, apiHost, categoryCode, unitCode, salesType, signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        if (!disposed) {
          setResult({
            sourceProduct: product, key: requestKey,
            product: mapProduct(options.product, 0), addons: options.addons.map(mapProduct),
            error: "", isLoading: false,
          });
        }
      } catch (error) {
        if (!disposed) {
          setResult({
            sourceProduct: product, key: requestKey, product: null, addons: [], isLoading: false,
            error: controller.signal.aborted
              ? "Loading coffee options timed out. Please try again."
              : error?.message || "Could not load coffee options. Please try again.",
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
  }, [product, apiHost, categoryCode, unitCode, salesType, mapProduct, requestKey]);

  // A new opening or pricing scope must not expose a previous drink/add-on
  // price, including the render before React runs the replacement effect.
  const current = product && result.sourceProduct === product && result.key === requestKey
    ? result
    : { product: null, addons: [], error: "", isLoading: Boolean(product) };
  return { product: current.product, addons: current.addons, isLoading: current.isLoading, error: current.error,
    retry: () => setAttempt((value) => value + 1) };
}
