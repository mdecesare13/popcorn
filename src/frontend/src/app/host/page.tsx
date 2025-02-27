// src/app/host/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Checkbox, Button } from '@/components/ui';

const STREAMING_SERVICES = [
  'Hulu',
  'Disney+',
  'Netflix',
  'Max',
  'Peacock'
];

export default function HostPage() {
  const router = useRouter();
  const [hostName, setHostName] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [errors, setErrors] = useState({
    hostName: '',
    services: '',
    submit: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleServiceToggle = (service: string) => {
    setSelectedServices(current => 
      current.includes(service)
        ? current.filter(s => s !== service)
        : [...current, service]
    );
    if (errors.services) {
      setErrors(prev => ({ ...prev, services: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors = {
      hostName: '',
      services: '',
      submit: ''
    };

    if (!hostName.trim()) {
      newErrors.hostName = 'Please enter your name';
    }

    if (selectedServices.length === 0) {
      newErrors.services = 'Please select at least one streaming service';
    }

    setErrors(newErrors);
    return !newErrors.hostName && !newErrors.services;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, submit: '' }));
  
    try {
      if (!process.env.NEXT_PUBLIC_CREATE_PARTY_URL) {
        throw new Error('CREATE_PARTY_URL is not defined in environment variables');
      }
  
      const response = await fetch(process.env.NEXT_PUBLIC_CREATE_PARTY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_name: hostName,
          streaming_services: selectedServices
        })
      });
  
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
  
      const data = await response.json();
      router.push(`/host/lobby/${data.party_id}`);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error ? error.message : 'Failed to create party'
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden font-['SF_Pro_Display',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-[url('/images/cinema-background.jpg')] bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%)"
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen">
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-16">
              <h1 className="text-7xl font-medium tracking-tight text-white mb-4">
                Popcorn
              </h1>
              <h2 className="text-2xl font-light text-white/70">
                Create Your Party
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12">
              {/* Host Name Input */}
              <div className="space-y-2">
                <Input
                  label="Host Name"
                  placeholder="Enter your name"
                  value={hostName}
                  onChange={(value) => {
                    setHostName(value);
                    if (errors.hostName) setErrors(prev => ({ ...prev, hostName: '' }));
                  }}
                  error={errors.hostName}
                  className="bg-white/5 backdrop-blur-sm border-white/10 text-white placeholder:text-white/30"
                  labelClass="text-white/70 font-light"
                  disabled={isSubmitting}
                />
              </div>

              {/* Streaming Services */}
              <div className="space-y-6">
                <h3 className="text-xl font-light text-white/70">
                  Streaming Services
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {STREAMING_SERVICES.map((service) => (
                    <Checkbox
                      key={service}
                      label={service}
                      checked={selectedServices.includes(service)}
                      onChange={() => handleServiceToggle(service)}
                      className="bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300"
                      labelClass="text-white/70 font-light"
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
                {errors.services && (
                  <p className="text-red-400 text-sm font-light">{errors.services}</p>
                )}
              </div>

              {errors.submit && (
                <p className="text-red-400 text-sm text-center font-light">{errors.submit}</p>
              )}

              {/* Submit Button */}
              <Button 
                type="submit"
                className="w-full bg-white/10 backdrop-blur-sm text-white text-lg font-light py-6 
                         rounded-xl hover:bg-white/20 transition-all duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Party...' : 'Create Party'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}