import * as React from 'react';
import { FormikConsumer } from './context';

export type FormikFormProps = Pick<
  React.FormHTMLAttributes<HTMLFormElement>,
  Exclude<keyof React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'>
>;

export function Form(props: FormikFormProps) {
  return (
    <FormikConsumer>
      {({ handleSubmit }) => <form onSubmit={handleSubmit} {...props} />}
    </FormikConsumer>
  );
}
