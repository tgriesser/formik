import * as React from 'react';
import { FormikConsumer } from './context';
import { Formik } from './Formik';
import { Omit } from './types';

export namespace Form {
  export type Props = Omit<
    React.FormHTMLAttributes<HTMLFormElement>,
    'onSubmit'
  >;
}

export function Form<Values = Formik.Values>(props: Form.Props) {
  return (
    <FormikConsumer<Values>>
      {({ handleSubmit }) => <form onSubmit={handleSubmit} {...props} />}
    </FormikConsumer>
  );
}
