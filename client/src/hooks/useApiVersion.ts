import { useContext } from "react";
import { ApiVersionContext, type ApiVersionContextValue } from "../context/ApiVersionContext";

export function useApiVersion(): ApiVersionContextValue {
  const ctx = useContext(ApiVersionContext);
  if (!ctx) throw new Error("useApiVersion must be used inside ApiVersionProvider");
  return ctx;
}
