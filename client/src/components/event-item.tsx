<div>
        <h4 className="text-base font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">
          {isRecurring 
            ? `${formatDay(dayOfWeek)}, ${format(new Date(`1970-01-01T${startTime}`), 'h:mm a')} - ${format(new Date(`1970-01-01T${endTime}`), 'h:mm a')}`
            : `${format(new Date(startDate), 'PPP')}, ${format(new Date(`1970-01-01T${startTime}`), 'h:mm a')} - ${format(new Date(`1970-01-01T${endTime}`), 'h:mm a')}`}
        </p>
        {description && <p className="text-sm mt-1">{description}</p>}
      </div>