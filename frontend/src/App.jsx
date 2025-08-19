// frontend/src/App.jsx

import { ConnectWallet } from './components/ConnectWallet.jsx';
import { SwapForm } from './components/SwapForm.jsx';
// Import the new AddLiquidityForm component
import { AddLiquidityForm } from './components/AddLiquidityForm.jsx';
import './App.css';
import { useAccount } from 'wagmi';

function App() {
  const { isConnected } = useAccount();

  return (
    <>
      <div className="card">
        <h1>Uniswap V3 Frontend</h1>
        <ConnectWallet />
        {isConnected && (
          <>
            <SwapForm />
            <AddLiquidityForm /> {/* Add the new form here */}
          </>
        )}
        {!isConnected && (
          <p style={{ marginTop: '20px' }}>
            Connect your wallet to get started.
          </p>
        )}
      </div>
    </>
  );
}

export default App;