import { useState, useEffect } from 'react'
import { Formik, Form, FormikHelpers, useFormikContext } from 'formik';
import { TextField, Select, MenuItem, InputLabel, FormControl, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material'

import * as Yup from 'yup';
import Swal from 'sweetalert2';
import LoadingCircle from '../../../../auth/helpers/Loading';

import { useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../../store/store';
import { ImCancelCircle } from "react-icons/im";
import axios from 'axios';
import bgform from './assets/formbg.jpg'
import { set } from 'date-fns';
import { PuffLoader  } from 'react-spinners';








export const LayerConfigForm = ({ setIsLayerConfigFormOpen, isLayerConfigFormOpen }) => {

    const location = useLocation();
    const dispatch = useDispatch();
    const { uid } = useSelector( (selector: RootState) => selector.auth);
    const { layers } = useSelector((state: RootState) => state.platypus);

    const { ID } = location.state.project;
    const { layerID } = location.state.layer;
    const layer = layers.find((layer) => layer._id === layerID);

    const LayerSchema = Yup.object().shape({
        name: Yup.string().required('Group name is required'),
        description: Yup.string(),
        visibility: Yup.string().required('Visibility is required'),
    });

    const [openDialog, setOpenDialog] = useState(false);
    const [tempVisibility, setTempVisibility] = useState(''); 
    const [IsLoading, setIsLoading] = useState(false);
    const [buttonDisabled, setButtonDisabled] = useState(false)


    const renderDialogContentText = () => {
        switch (tempVisibility) {
          case 'open':
            return (
              <DialogContentText>
                Are you sure you want to change the visibility type? The "Open" will alow all users in PrjManager to access the layer information.
              </DialogContentText>
            );
          case 'internal':
            return (
              <DialogContentText>
                Are you sure you want to change the visibility type? The "Internal" type will allow all project collaborators to access the layer information.
              </DialogContentText>
            );
          case 'restricted':
            return (
              <DialogContentText>
                Are you sure you want to change the visibility type? The "Restricted" type will allow only collaborators of the layer to access the information contained.
              </DialogContentText>
            );
          default:
            return null; // o algún otro componente JSX por defecto
        }
    };

    const handleVisibilityChange = (event, setFieldValue) => {
        const selectedVisibility = event.target.value;
        if (selectedVisibility !== layer?.visibility) {
            setTempVisibility(selectedVisibility); // Almacenar temporalmente la nueva visibilidad seleccionada
            setOpenDialog(true); // Abrir el diálogo para confirmar el cambio
        } else {
            // Si la nueva visibilidad es la misma que la actual, no necesitas hacer nada
            setFieldValue('visibility', selectedVisibility); // Actualizar el valor del campo de formulario
        }
    };

    const handleConfirmChange = (setFieldValue) => {
        // Confirmar el cambio de visibilidad
        setFieldValue('visibility', tempVisibility); // Actualizar el valor del campo de formulario
        setOpenDialog(false); // Cerrar el diálogo
    };

    const handleCloseDialog = () => {
        setOpenDialog(false); 
    };

    const handleClose = () => {
        const modal = document.getElementById('layerConfigModal');
        if (modal) {
            // Inicia la transición de opacidad a 0
            modal.classList.replace('opacity-100', 'opacity-0');

            // Espera a que la animación termine antes de ocultar el modal completamente
            setTimeout(() => {
                setIsLayerConfigFormOpen(false);
            }, 500); // Asume que la duración de tu transición es de 500ms
        }
    };

    const IsTheButtonDisabled = ({values}) => {
        useEffect(() => {
            const isDisabled = values.name === layer.name && values.description === layer.description && values.visibility === layer.visibility;
            setButtonDisabled(isDisabled);
        }, [values, layer.name, layer.description, layer.visibility]);
        
        // Utiliza buttonDisabled para cualquier lógica relacionada aquí, o retorna este estado si es necesario
        return null; // Este componente no necesita renderizar nada por sí mismo
    };



    const handleSubmit = async (values, { setSubmitting, resetForm }) => {
        setIsLoading(true);
        setSubmitting(true);

        try {
            const response = await axios.put(`http://localhost:3000/api/layer/update-layer/${ID}/${layerID}`, values, 
            { 
                params: {
                    uid
                },
                headers: { 
                    'Authorization': localStorage.getItem('x-token') 
                } 
            } )

            resetForm();
            setSubmitting(false);         
            setIsLoading(false);
            handleClose();

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: response.data.message
            });

        } catch (error) {
            setSubmitting(false);
            setIsLoading(false);

            if(  error.response.data?.type === 'collaborator-validation' ){
                handleClose();
                Swal.fire({
                    icon: 'warning',
                    title: 'Access Validation',
                    text: error.response.data.message,
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: error.response.data.message,
                });
            }
        }
    };


    useEffect(() => {
        if (isLayerConfigFormOpen) {
          const timer = setTimeout(() => {
            document.getElementById('layerConfigModal').classList.remove('opacity-0');
            document.getElementById('layerConfigModal').classList.add('opacity-100');
          }, 20); // Un retraso de 20ms suele ser suficiente
          return () => clearTimeout(timer);
        }
      }, [isLayerConfigFormOpen]);

  return (

    <div className='fixed flex w-screen h-screen top-0 right-0 justify-center items-center z-50'>
        <div 
            id="layerConfigModal" 
            style={{ 
                backgroundImage: `url(${bgform})`,
                backgroundPosition: 'bottom center'

            }}
            className={`flex flex-col space-y-7 w-[70%] bg-white border-[1px] border-black md:w-[40%] md:h-[450px] max-h-[560px] rounded-2xl pb-4 overflow-y-auto  transition-opacity duration-500 ease-in-out opacity-0 ${isLayerConfigFormOpen ? '' : 'pointer-events-none'}`}>
            
            <div className='flex justify-between w-[95%] h-12 ml-auto mr-auto mt-2 p-2 border-b-2 border-b-gray-500'>
                <p className='text-xl text-black'>Layer Configuration</p>
                <button onClick={handleClose}>
                        <ImCancelCircle/>
                </button>       
            </div>
            
            { 
                IsLoading 
                ? ( 
                    <div className='flex flex-grow items-center justify-center'>
                        <PuffLoader  color="#32174D" size={50} /> 
                    </div>                         
                  )   
                : ( 
                        <Formik
                            initialValues={{
                                name: layer.name,
                                description: layer.description,
                                visibility: layer.visibility                                                    
                            }}
                            validationSchema={LayerSchema}                     
                            onSubmit={handleSubmit}
                        >
                    
                            {({ isSubmitting, values, setFieldValue, handleChange, handleBlur }) => (                   
                                <Form className='flex flex-col h-full space-y-4 mx-auto w-[95%]'>
                                    <IsTheButtonDisabled values={values} />

                                    <TextField                                      
                                        name="name"
                                        label="Layer Name"                             
                                        fullWidth
                                        value={values.name}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                    />

                                    <FormControl fullWidth>
                                    <InputLabel id="visibility-label">Visibility</InputLabel>
                                    <Select
                                        labelId="visibility-label"
                                        id="visibility"
                                        name="visibility"
                                        value={values.visibility}
                                        onChange={ (e) => handleVisibilityChange( e, setFieldValue ) }
                                        onBlur={handleBlur}
                                        label="Visibility" // Esto establece la etiqueta para el Select
                                    >
                                        <MenuItem value="open">Open</MenuItem>
                                        <MenuItem value="internal">Internal</MenuItem>
                                        <MenuItem value="restricted">Restricted</MenuItem>
                                    </Select>
                                    </FormControl>

                                    <TextField                                      
                                        name="description"
                                        label="Description"
                                        multiline
                                        rows={4}
                                        fullWidth
                                        value={values.description}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                    />



                                    <Dialog open={openDialog} onClose={handleCloseDialog}>
                                        <DialogTitle>Confirm Visibility Change</DialogTitle>
                                        <DialogContent>
                                            { renderDialogContentText()}                                          
                                        </DialogContent>
                                        <DialogActions>
                                            <Button onClick={handleCloseDialog}>Cancel</Button>
                                            <Button onClick={ () => handleConfirmChange(setFieldValue) } autoFocus>
                                                Confirm
                                            </Button>
                                        </DialogActions>
                                    </Dialog>

                                                                           

                                    <div className='flex w-full h-full space-x-2 justify-center items-center'>                           
                                        <button 
                                            className={`w-[95%] h-[55px] rounded-extra p-2 ${ buttonDisabled ? 'backdrop-blur-sm' : 'backdrop-blur-sm bg-green-400/20 shadow-sm' } border-[1px] border-gray-400 transition-colors duration-300 ease-in-out transform active:translate-y-[2px]`} 
                                            type="submit" disabled={ buttonDisabled || isSubmitting }>Update Layer
                                        </button>
                                    </div>

                                </Form>
                            )}
                        </Formik>
                )
            }             
        </div>
    </div>


  )
}