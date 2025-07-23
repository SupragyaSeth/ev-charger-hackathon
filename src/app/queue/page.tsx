export default function QueuePage() {
  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Charger Queue</h1>
      <p className="mb-4">
        Below is the current queue for EV chargers. Sign in to join the queue.
      </p>
      {/* Placeholder for queue list */}
      <ul className="list-disc pl-5 mb-4">
        <li>John Doe (10:00 - 11:00)</li>
        <li>Jane Smith (11:00 - 12:00)</li>
      </ul>
      <button className="bg-blue-600 text-white px-4 py-2 rounded">
        Join Queue
      </button>
    </div>
  );
}
