/**
 * Auth0 Action: Assign Role for Passwordless Users
 * 
 * This Action automatically assigns roles to users based on their authentication method:
 * - Passwordless (email) users: Default to WAREHOUSE role (logistics)
 * - Social login users: Use role from appState or user metadata
 * - Existing users: Keep their assigned role
 * 
 * INSTRUCTIONS:
 * 1. Go to Auth0 Dashboard → Actions → Flows → Login
 * 2. Click "+ Custom" → "Build Custom"
 * 3. Name: "Assign Role for Passwordless Users"
 * 4. Copy and paste this entire file
 * 5. Click "Deploy"
 * 6. Drag the Action into the Login flow (after "Start")
 * 7. Click "Apply"
 */

exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://boxity.app';
  
  // Check authentication method
  const connectionName = event.connection.name || '';
  const connectionStrategy = event.connection.strategy || '';
  const isPasswordless = connectionName === 'email' || connectionStrategy === 'email';
  const isSocial = connectionStrategy === 'google-oauth2' || connectionStrategy === 'apple';
  
  // Get existing role from user metadata (if admin assigned)
  let role = event.user.app_metadata?.role || 
             event.user.user_metadata?.role;
  
  // For passwordless users without a role, assign default WAREHOUSE role
  if (!role && isPasswordless) {
    role = 'WAREHOUSE'; // Default for logistics/warehouse users
    
    // Update user metadata for future logins
    api.user.setUserMetadata('role', role);
    
    console.log(`Assigned default role WAREHOUSE to passwordless user: ${event.user.email}`);
  }
  
  // For social logins, try to get role from appState (passed from frontend)
  if (isSocial && !role) {
    // Check if role was passed in appState (from frontend localStorage)
    // Note: appState is not directly available in Actions, so we rely on user metadata
    // The frontend stores role in localStorage, which should be synced via Management API
    // For now, we'll use a default or check user metadata
    const storedRole = event.user.user_metadata?.selected_role;
    if (storedRole) {
      role = storedRole;
    }
  }
  
  // If role exists (from metadata or default), add it to the token
  if (role) {
    // Add role to ID token (for frontend)
    api.idToken.setCustomClaim(`${namespace}/role`, role);
    
    // Add role to access token (for backend API)
    api.accessToken.setCustomClaim(`${namespace}/role`, role);
    
    console.log(`Added role claim to token: ${role} for user: ${event.user.email}`);
  } else {
    console.warn(`No role assigned for user: ${event.user.email}, connection: ${connectionName}`);
  }
};

