import React from 'react'
import {LoaderIcon} from 'lucide-react'
function PageLoader() {
  return (
    <div className='items-center flex justify-center h-screen'>
        <LoaderIcon className="size-10 animate-spin" />
    </div>
  )
}

export default PageLoader