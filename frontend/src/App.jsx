import { Routes, Route } from 'react-router-dom';
import CreateTournament from './pages/CreateTournament.jsx';
import OrganizerDashboard from './pages/OrganizerDashboard.jsx';
import TeamJoin from './pages/TeamJoin.jsx';
import TeamDashboard from './pages/TeamDashboard.jsx';
import PublicView from './pages/PublicView.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateTournament />} />
      <Route path="/t/:tournamentId/join" element={<TeamJoin />} />
      <Route path="/t/:tournamentId/team" element={<TeamDashboard />} />
      <Route path="/t/:tournamentId/admin" element={<OrganizerDashboard />} />
      <Route path="/t/:tournamentId" element={<PublicView />} />
    </Routes>
  );
}
