import { Formik } from './Formik';

export type FormikChangeListener = (forms: Formik<any>[]) => any;

/**
 * Keep track of every mounted form, for debugging, etc.
 */
export const mountedFormRegistry: Formik<any>[] = [];

/**
 * Adds a change listener, provided with the form registry
 * anytime a form changes. Useful for something like storybook.
 */
export const changeListeners: FormikChangeListener[] = [];
