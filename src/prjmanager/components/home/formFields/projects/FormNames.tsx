import { TextField } from '@mui/material';
import { useField, useFormikContext, FormikValues } from 'formik';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store/store';

export const FormNames = () => {

  const { username } = useSelector( (selector: RootState) => selector.auth)
  const [nameField, nameMeta] = useField('name');
  const [ownerField, ownerMeta] = useField('owner');


  const { submitCount } = useFormikContext<FormikValues>();
  const showError0 = submitCount > 0 && nameMeta.error ? true : false;
  const showError1 = submitCount > 0 && ownerMeta.error ? true : false;

  return (
    <div className='flex w-full h-10 ml-auto mr-auto  rounded-extra  space-x-2'>
      <TextField 
        {...nameField}
        className='w-[50%]' 
        type='text'
        label='Project Name'
        variant='standard'
        error={showError0}
        helperText={showError0 ? nameMeta.error : ''}
      />
      <TextField 
        {...ownerField}
        className='w-[50%]' 
        type='text'
        label='Owner'
        value={username}
        variant='standard'
        disabled
        error={showError1}
        helperText={showError1 ? ownerMeta.error : ''}
      />
    </div>
  );
};