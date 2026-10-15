import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';

export const NotFoundPage = () => (
  <div className="mx-auto max-w-xl py-10">
    <EmptyState
      title="Page not found"
      description="That link does not lead anywhere in ExamPilot."
      action={
        <Button asChild>
          <Link to="/assessments">Back to assessments</Link>
        </Button>
      }
    />
  </div>
);
