<div>
        <h3 className="font-medium">{event.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {event.isRecurring
              ? `Every ${formatDay(event.dayOfWeek)}`
              : formatDate(new Date(event.startDate))}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {format(new Date(`1970-01-01T${event.startTime}`), 'h:mm a')} - {format(new Date(`1970-01-01T${event.endTime}`), 'h:mm a')}
          </p>
        </div>
        {event.description && (
          <p className="text-sm mt-2">{event.description}</p>
        )}
      </div>