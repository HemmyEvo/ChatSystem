import { ArrowLeftIcon, MoveLeft } from 'lucide-react'
import React from 'react'

function GoBackButton({ onClick }) {
  return (
    <div className=' text-slate-300 cursor-pointer' onClick={onClick}>
        <ArrowLeftIcon size={20} />
    </div>
  )
}

export default GoBackButton