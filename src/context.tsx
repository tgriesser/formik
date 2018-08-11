import * as React from 'react';
import { Formik } from './Formik';

export const {
  Provider: ReactProvider,
  Consumer: ReactConsumer,
} = React.createContext<Formik.Context<any> | undefined>(undefined);

export function FormikProvider<Values>(
  props: React.ProviderProps<Formik.Context<Values>>
) {
  return <ReactProvider {...props} />;
}

export function FormikConsumer<Values>(
  props: React.ConsumerProps<Formik.Context<Values>>
) {
  return (
    <ReactConsumer
      {...props}
      children={value => {
        if (typeof value === 'undefined') {
          throw new Error(
            'Formik element cannot be used outside of a <Formik /> form'
          );
        }
        return props.children(value);
      }}
    />
  );
}
