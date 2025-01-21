// src/app/host/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Checkbox, Button } from '@/components/ui';
const CREATE_PARTY_URL = process.env.NEXT_PUBLIC_CREATE_PARTY_URL;

const STREAMING_SERVICES = [
  'Hulu',
  'Disney+',
  'Netflix',
  'Max',
  'Peacock'
];

// API URL from your configuration
const API_URL = 'https://wt9cfldca5.execute-api.us-east-1.amazonaws.com/v2';

export default function HostPage() {
  console.log('CREATE_PARTY_URL:', process.env.NEXT_PUBLIC_CREATE_PARTY_URL);
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
    
    if (!validateForm()) {
      return;
    }
  
    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, submit: '' }));
  
    try {
      if (!process.env.NEXT_PUBLIC_CREATE_PARTY_URL) {
        throw new Error('CREATE_PARTY_URL is not defined in environment variables');
      }
  
      const url = process.env.NEXT_PUBLIC_CREATE_PARTY_URL;
      console.log('Attempting to fetch from:', url);
  
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host_name: hostName,
          streaming_services: selectedServices
        })
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
  
      const data = await response.json();
      console.log('Created party with ID:', data.party_id);
      router.push(`/host/lobby/${data.party_id}`);
    } catch (error) {
      console.error('Detailed error:', error);
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error 
          ? `Error: ${error.message}` 
          : 'Failed to create party - unknown error'
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-center text-yellow-400">
            Popcorn
          </h1>
          <h2 className="text-4xl font-bold text-center">
            Create Party
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <Input
            label="Host Name"
            placeholder="Enter your name"
            value={hostName}
            onChange={(value) => {
              setHostName(value);
              if (errors.hostName) {
                setErrors(prev => ({ ...prev, hostName: '' }));
              }
            }}
            error={errors.hostName}
            style={{ color: '#063970' }}
            disabled={isSubmitting}
          />

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">
              Streaming Services
            </h3>
            <div className="space-y-3">
              {STREAMING_SERVICES.map((service) => (
                <Checkbox
                  key={service}
                  label={service}
                  checked={selectedServices.includes(service)}
                  onChange={() => handleServiceToggle(service)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
            {errors.services && (
              <p className="text-red-500 text-sm mt-1">{errors.services}</p>
            )}
          </div>

          {errors.submit && (
            <p className="text-red-500 text-sm text-center">{errors.submit}</p>
          )}

          <Button 
            type="submit"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Party...' : 'Create Party'}
          </Button>
        </form>
      </div>
    </main>
  );
}