import { useCallback, useState } from "react";

type FieldErrors = Record<string, string[]>;

// The field errors a server action answered with, for a form that hands them to <Form
// validationErrors>. React Aria keeps such an error on its field until that exact field is edited,
// which is wrong when the verdict depended on another input: a "not enough funds" error under the
// amount stays after the user switches the card or the date that caused it, and blocks sending again.
// `clearFieldErrors` is for those other inputs: call it when one of them changes. It keeps the same
// object when there is nothing to clear, so it costs no render.
export const useServerFieldErrors = <
  Errors extends FieldErrors = FieldErrors,
>() => {
  const [fieldErrors, setFieldErrors] = useState<Errors>({} as Errors);

  const clearFieldErrors = useCallback(
    () =>
      setFieldErrors((current) =>
        Object.keys(current).length === 0 ? current : ({} as Errors),
      ),
    [],
  );

  return { fieldErrors, setFieldErrors, clearFieldErrors };
};
