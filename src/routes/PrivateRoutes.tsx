import { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import useCheckAuth from "../hooks/useCheckAuth"



interface PrivateRoutesProps {
    children: ReactNode
}


const PrivateRoutes = ({ children }: PrivateRoutesProps ) => {

    const { status } = useCheckAuth()

    return ( status === 'authenticated')
    ? children
    : <Navigate to='/login'/>

}

export default PrivateRoutes
