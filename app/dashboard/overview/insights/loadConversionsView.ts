import { toConversionsView } from "@/components/Conversions/utils";
import { getConversions } from "@/core/conversions/service";

// Starts loading the month's conversions and returns at once, without awaiting them: the page hands
// the promise straight to the client component, so its header renders first and only the content
// waits.
//
// The promise is created here, once per request, so its identity is stable: a client component that
// waits on it gets the same promise on every render.
export const loadConversionsView = (userId: string, month: string) => ({
  conversions: getConversions(userId, month).then(toConversionsView),
});
