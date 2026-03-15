import React, { useState } from 'react'
  import { useAuthStore } from '../store/useAuthStore.js'
  import BorderAnimated from '../components/BorderAnimated'
  import { LoaderIcon, LockIcon, Mail, MessageCircle, UserIcon } from 'lucide-react'
  import { Link } from 'react-router'

  function SignUpPage() {
    const [formData, setFormData] = useState({fullname: '',email: '',password: '',})
    const {signup, isSigningup} = useAuthStore()
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting form with data:', formData)
    signup(formData)
  }
  return (
    <div className='w-full flex items-center justify-center p-4 bg-slate-900'>
      <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]">
        <BorderAnimated>
          <div className="flex w-full flex-col md:flex-row">
            {/* Left Side - Form */}
            <div className="md:w-1/2 p-8 flex items-center justify-center md:border-r border-slate-600/30">
              <div className="w-full max-w-md">
                {/* Heading Text  */}
                <div className="text-center mb-8">
                <MessageCircle className="size-12 mx-auto text-slate-400 mb-4" />
                <h2 className="text-2xl font-bold text-center mb-2 text-slate-200">Create an Account</h2>
                <p className="text-slate-400 text-sm text-center mb-6">
                  Join our community and start connecting with others today.
                </p>
                </div>

                {/* Form  */}
               <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full name  Input*/}
                <div>
                  <label className='auth-input-label'>Full name</label>
                  <div className="relative">
                    <UserIcon className='auth-input-icon'/>
                    <input
                      type="text"
                      name="fullname"
                      value={formData.fullname}
                      onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                      required
                      className='input'
                      placeholder='Enter your full name'
                    />
                  </div>
      
                </div>
                
                {/* Email input */}
                <div>
                  <label className='auth-input-label'>Email</label>
                  <div className="relative">
                    <Mail className='auth-input-icon'/>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                      className='input'
                      placeholder='Enter your email'
                    />
                  </div>
      
                </div>

                {/* Password input */}
                <div>
                  <label className='auth-input-label'>Password</label>
                  <div className="relative">
                    <LockIcon className='auth-input-icon'/>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      className='input'
                      placeholder='Enter your password'
                    />
                  </div>
      
                </div>
                {/* Submit Button */}
                <button
                  type="submit"
                  className='auth-btn'
                  disabled={isSigningup}
                >
                  {isSigningup ? <LoaderIcon className="h-5 w-full text-center animate-spin" />: 'Create Account'}
                </button>
               </form>
              <div className="mt-6 text-center">
              <Link to="/login" className="auth-link">
              Already have an account? Log in
              </Link>
              
              </div>
               </div>
            </div>

            {/* Right Side - Image/Illustration */}
          <div className="hidden md:w-1/2 md:flex items-center justify-center p-6 bg-gradient-to-bl from-slate-800/20 to-transparent">
            <div>
              <img
                src="/signup.png"
                alt="People using mobile devices"
                className="w-full h-auto object-contain"
              />
              <div className="mt-6 text-center">
                <h3 className="text-xl font-medium text-cyan-400">Start Your Journey Today</h3>

                <div className="mt-4 flex justify-center gap-4">
                  <span className="auth-badge">Free</span>
                  <span className="auth-badge">Easy Setup</span>
                  <span className="auth-badge">Private</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </BorderAnimated>
        
      </div>
    </div>
  )
}

export default SignUpPage

